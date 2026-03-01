import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ConfigType } from '@nestjs/config';
import { CorrectionCaptureReviewReason, Prisma } from '../../../../.prisma/client';
import correctionConfig from '../config/correction.config';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../../queue/constants/queue.constants';
import { STORAGE_PROVIDER } from '../../storage/providers';
import type IS3Provider from '../../storage/providers/s3/s3.interface';
import { CorrectionEventStageEnum } from '../enums/correction-event-stage.enum';
import type { CorrectionJobPayload } from '../objects/correction-job-payload.object';
import { CorrectionPublisherService } from '../services/correction-publisher.service';
import { CorrectionMetricsService } from '../services/shared/correction-metrics.service';

type OmrProcessResponse = {
   success?: boolean;
   engineVersion?: string;
   qr?: {
      data?: string;
      validSignature?: boolean;
   };
   registration?: {
      value?: string | null;
      status?: string;
   };
   answers?: Array<{
      question?: number;
      selected?: number | null;
      isAmbiguous?: boolean;
      confidence?: number[];
   }>;
   answers_numeric?: number[];
   images?: {
      rectifiedBase64?: string;
      overlayBase64?: string;
   };
   timings?: Record<string, unknown>;
   error?: {
      code?: string;
      message?: string;
   };
};

@Processor(QUEUES.CORRECTION_OMR)
@Injectable()
export class CorrectionOmrProcessor extends WorkerHost {
   private readonly logger = new Logger(CorrectionOmrProcessor.name);

   constructor(
      private readonly prisma: PrismaService,
      private readonly publisher: CorrectionPublisherService,
      private readonly metrics: CorrectionMetricsService,
      @Inject(STORAGE_PROVIDER)
      private readonly storage: IS3Provider,
      @Inject(correctionConfig.KEY)
      private readonly config: ConfigType<typeof correctionConfig>,
   ) {
      super();
   }

   async process(job: Job<CorrectionJobPayload>): Promise<void> {
      const startedAtMs = Date.now();
      const { captureId, sessionId, threshold, delta } = job.data;

      const capture = await this.prisma.correctionCapture.findUnique({
         where: { id: captureId },
         include: {
            Exam: {
               include: {
                  Questions: {
                     orderBy: { number: 'asc' },
                  },
                  TemplateVersion: true,
               },
            },
         },
      });

      if (!capture) {
         return;
      }

      const queueLatencyMs = Math.max(0, Date.now() - capture.createdAt.getTime());

      await this.prisma.correctionCapture.update({
         where: { id: capture.id },
         data: {
            status: 'processing',
            queueLatencyMs,
         },
      });

      await this.publisher.publish({
         sessionId,
         captureId,
         stage: CorrectionEventStageEnum.CAPTURE_PROCESSING,
         payload: {
            captureId,
            queueLatencyMs,
         },
      });

      if (!capture.Exam.TemplateVersion) {
         await this.markNeedsReview({
            captureId,
            sessionId,
            startedAtMs,
            reason: CorrectionCaptureReviewReason.omr_error,
            errorMessage: 'A prova não possui template versionado associado.',
         });
         return;
      }

      let originalBuffer: Buffer;
      try {
         originalBuffer = await this.storage.downloadFileAsBuffer(
            capture.originalImagePath,
         );
      } catch (error) {
         await this.markError({
            captureId,
            sessionId,
            startedAtMs,
            errorMessage: 'Falha ao baixar imagem original para processamento.',
            extra: { error: (error as Error).message },
         });
         return;
      }

      let omrResponse: OmrProcessResponse;
      try {
         const controller = new AbortController();
         const timeout = setTimeout(() => {
            controller.abort();
         }, this.config.omrRequestTimeoutMs);

         try {
            const response = await fetch(
               `${this.config.omrBaseUrl.replace(/\/$/, '')}/api/v2/omr/process`,
               {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                     imageBase64: originalBuffer.toString('base64'),
                     compiledGeometryJson:
                        capture.Exam.TemplateVersion.compiledGeometryJson,
                     threshold,
                     delta,
                  }),
                  signal: controller.signal,
               },
            );

            if (!response.ok) {
               throw new Error(`OMR retornou HTTP ${response.status}.`);
            }

            omrResponse = (await response.json()) as OmrProcessResponse;
         } finally {
            clearTimeout(timeout);
         }
      } catch (error) {
         await this.markError({
            captureId,
            sessionId,
            startedAtMs,
            errorMessage: 'Falha de comunicação com o motor OMR.',
            extra: { error: (error as Error).message },
         });
         return;
      }

      const detectionPayload = this.toJson({
         timings: omrResponse.timings ?? null,
      });
      const omrPayload = this.toJson(omrResponse);

      const [rectifiedImagePath, overlayImagePath] = await Promise.all([
         this.saveBase64Artifact(
            omrResponse.images?.rectifiedBase64,
            `corrections/sessions/${sessionId}/rectified`,
         ),
         this.saveBase64Artifact(
            omrResponse.images?.overlayBase64,
            `corrections/sessions/${sessionId}/overlay`,
         ),
      ]);

      if (!omrResponse.success) {
         await this.markNeedsReview({
            captureId,
            sessionId,
            startedAtMs,
            reason: CorrectionCaptureReviewReason.omr_error,
            errorMessage:
               omrResponse.error?.message || 'OMR não conseguiu ler a folha.',
            rectifiedImagePath,
            overlayImagePath,
            detectionPayload,
            omrPayload,
         });
         return;
      }

      const qrValidation = this.validateQr(
         omrResponse.qr?.data,
         this.config.qrHmacSecret,
      );

      if (!qrValidation.valid) {
         await this.markNeedsReview({
            captureId,
            sessionId,
            startedAtMs,
            reason: qrValidation.reason,
            errorMessage: qrValidation.error,
            rectifiedImagePath,
            overlayImagePath,
            detectionPayload,
            omrPayload,
            engineVersion: omrResponse.engineVersion,
         });
         return;
      }

      if (qrValidation.examId && qrValidation.examId !== capture.examId) {
         await this.markNeedsReview({
            captureId,
            sessionId,
            startedAtMs,
            reason: CorrectionCaptureReviewReason.qr_invalid,
            errorMessage: 'QR corresponde a uma prova diferente da sessão.',
            rectifiedImagePath,
            overlayImagePath,
            detectionPayload,
            omrPayload,
            engineVersion: omrResponse.engineVersion,
         });
         return;
      }

      const registrationNumber =
         omrResponse.registration?.value ?? qrValidation.registrationNumber ?? null;

      if (!registrationNumber) {
         await this.markNeedsReview({
            captureId,
            sessionId,
            startedAtMs,
            reason: CorrectionCaptureReviewReason.registration_invalid,
            errorMessage: 'Matrícula não identificada na folha.',
            rectifiedImagePath,
            overlayImagePath,
            detectionPayload,
            omrPayload,
            engineVersion: omrResponse.engineVersion,
         });
         return;
      }

      const student = await this.prisma.student.findUnique({
         where: { registrationNumber },
         select: { id: true },
      });

      if (!student) {
         await this.markNeedsReview({
            captureId,
            sessionId,
            startedAtMs,
            reason: CorrectionCaptureReviewReason.registration_invalid,
            errorMessage: 'Matrícula não encontrada na base para esta correção.',
            rectifiedImagePath,
            overlayImagePath,
            detectionPayload,
            omrPayload,
            registrationNumber,
            engineVersion: omrResponse.engineVersion,
         });
         return;
      }

      const answers = this.normalizeAnswers(
         omrResponse,
         capture.Exam.Questions.length,
      );

      if (answers.hasAmbiguity) {
         await this.markNeedsReview({
            captureId,
            sessionId,
            startedAtMs,
            reason: CorrectionCaptureReviewReason.answer_ambiguous,
            errorMessage: 'Folha com ambiguidades de marcação.',
            rectifiedImagePath,
            overlayImagePath,
            detectionPayload,
            omrPayload,
            registrationNumber,
            studentId: student.id,
            engineVersion: omrResponse.engineVersion,
         });
         return;
      }

      const questionMap = new Map(
         capture.Exam.Questions.map((question) => [question.number, question]),
      );

      let score = 0;
      const correctionItems: Array<{
         questionId: string;
         selected: number | null;
         isCorrect: boolean | null;
      }> = [];

      for (let number = 1; number <= capture.Exam.Questions.length; number += 1) {
         const question = questionMap.get(number);
         if (!question) continue;

         const selected = answers.values[number - 1] ?? null;
         const isCorrect =
            selected === null ? null : selected === question.correct;

         if (isCorrect) {
            score += question.value;
         }

         correctionItems.push({
            questionId: question.id,
            selected,
            isCorrect,
         });
      }

      const attempt =
         (await this.prisma.correctionExam.count({
            where: {
               examId: capture.examId,
               studentId: student.id,
            },
         })) + 1;

      const processingMs = Math.max(0, Date.now() - startedAtMs);

      const correction = await this.prisma.$transaction(async (tx) => {
         const createdCorrection = await tx.correctionExam.create({
            data: {
               examId: capture.examId,
               studentId: student.id,
               filePath: capture.originalImagePath,
               attempt,
               score,
               status: 'graded',
               metadata: {
                  source: 'omr_v2',
                  captureId,
                  omrEngineVersion: omrResponse.engineVersion ?? 'unknown',
               } as Prisma.InputJsonValue,
            },
         });

         await tx.correctionQuestion.createMany({
            data: correctionItems.map((item) => ({
               correctionId: createdCorrection.id,
               questionId: item.questionId,
               selected: item.selected,
               isCorrect: item.isCorrect,
            })),
         });

         await tx.correctionCapture.update({
            where: { id: capture.id },
            data: {
               status: 'graded',
               reviewReasons: [],
               reviewNotes: null,
               errorMessage: null,
               correctionExamId: createdCorrection.id,
               studentId: student.id,
               registrationNumber,
               engineVersion: omrResponse.engineVersion ?? null,
               processingMs,
               rectifiedImagePath,
               overlayImagePath,
               detectionPayload,
               omrPayload,
            },
         });

         return createdCorrection;
      });

      await this.publisher.publish({
         sessionId,
         captureId,
         stage: CorrectionEventStageEnum.CAPTURE_GRADED,
         durationMs: processingMs,
         payload: {
            captureId,
            correctionId: correction.id,
            score,
            attempt,
            registrationNumber,
         },
      });

      await this.metrics.refreshSessionMetrics(sessionId);
   }

   private normalizeAnswers(omr: OmrProcessResponse, questionCount: number) {
      if (Array.isArray(omr.answers) && omr.answers.length > 0) {
         const values = Array.from({ length: questionCount }, () => null as number | null);
         let hasAmbiguity = false;

         for (const answer of omr.answers) {
            const questionIndex = (answer.question ?? 0) - 1;
            if (questionIndex < 0 || questionIndex >= questionCount) continue;

            if (answer.isAmbiguous) {
               hasAmbiguity = true;
               values[questionIndex] = null;
               continue;
            }

            const selected =
               typeof answer.selected === 'number' && answer.selected >= 1 && answer.selected <= 5
                  ? answer.selected
                  : null;

            values[questionIndex] = selected;
         }

         return { values, hasAmbiguity };
      }

      const picks = Array.isArray(omr.answers_numeric) ? omr.answers_numeric : [];
      const values = Array.from({ length: questionCount }, () => null as number | null);
      let hasAmbiguity = false;

      for (let i = 0; i < questionCount; i += 1) {
         const pick = picks[i];

         if (pick === -2) {
            hasAmbiguity = true;
            values[i] = null;
            continue;
         }

         if (typeof pick === 'number' && pick >= 0 && pick <= 4) {
            values[i] = pick + 1;
         }
      }

      return { values, hasAmbiguity };
   }

   private validateQr(
      rawQrData: string | undefined,
      secret: string,
   ): {
      valid: boolean;
      reason: CorrectionCaptureReviewReason;
      registrationNumber?: string;
      examId?: string;
      error?: string;
   } {
      if (!rawQrData || rawQrData.trim().length === 0) {
         return {
            valid: false,
            reason: CorrectionCaptureReviewReason.qr_missing,
            error: 'QR não encontrado.',
         };
      }

      let payloadText = '';
      let signature = '';

      try {
         const parsed = JSON.parse(rawQrData) as Record<string, unknown>;
         if (typeof parsed.payload === 'string' && typeof parsed.sig === 'string') {
            payloadText = parsed.payload;
            signature = parsed.sig;
         }
      } catch {
         // ignore
      }

      if (!payloadText || !signature) {
         const tokenParts = rawQrData.split('.');
         if (tokenParts.length !== 2) {
            return {
               valid: false,
               reason: CorrectionCaptureReviewReason.qr_invalid,
               error: 'Formato do QR inválido.',
            };
         }

         [payloadText, signature] = tokenParts;
      }

      const expectedSig = createHmac('sha256', secret)
         .update(payloadText)
         .digest('hex');

      const expectedBuffer = Buffer.from(expectedSig);
      const receivedBuffer = Buffer.from(signature);

      if (
         expectedBuffer.length !== receivedBuffer.length ||
         !timingSafeEqual(expectedBuffer, receivedBuffer)
      ) {
         return {
            valid: false,
            reason: CorrectionCaptureReviewReason.qr_signature_invalid,
            error: 'Assinatura do QR inválida.',
         };
      }

      try {
         const payload = JSON.parse(payloadText) as Record<string, unknown>;

         const registrationNumber =
            typeof payload.registrationNumber === 'string'
               ? payload.registrationNumber
               : typeof payload.registration === 'string'
                 ? payload.registration
                 : undefined;

         const examId =
            typeof payload.examId === 'string' ? payload.examId : undefined;

         return {
            valid: true,
            reason: CorrectionCaptureReviewReason.manual_review,
            registrationNumber,
            examId,
         };
      } catch {
         return {
            valid: false,
            reason: CorrectionCaptureReviewReason.qr_invalid,
            error: 'Payload do QR inválido.',
         };
      }
   }

   private async markNeedsReview(input: {
      captureId: string;
      sessionId: string;
      startedAtMs: number;
      reason: CorrectionCaptureReviewReason;
      errorMessage: string;
      rectifiedImagePath?: string;
      overlayImagePath?: string;
      detectionPayload?: Prisma.InputJsonValue;
      omrPayload?: Prisma.InputJsonValue;
      registrationNumber?: string;
      studentId?: string;
      engineVersion?: string;
   }) {
      const processingMs = Math.max(0, Date.now() - input.startedAtMs);

      await this.prisma.correctionCapture.update({
         where: { id: input.captureId },
         data: {
            status: 'needs_review',
            reviewReasons: [input.reason],
            errorMessage: input.errorMessage,
            processingMs,
            rectifiedImagePath: input.rectifiedImagePath,
            overlayImagePath: input.overlayImagePath,
            detectionPayload: input.detectionPayload,
            omrPayload: input.omrPayload,
            registrationNumber: input.registrationNumber,
            studentId: input.studentId,
            engineVersion: input.engineVersion,
         },
      });

      await this.publisher.publish({
         sessionId: input.sessionId,
         captureId: input.captureId,
         stage: CorrectionEventStageEnum.CAPTURE_NEEDS_REVIEW,
         durationMs: processingMs,
         payload: {
            captureId: input.captureId,
            reason: input.reason,
            errorMessage: input.errorMessage,
         },
      });

      await this.metrics.refreshSessionMetrics(input.sessionId);
   }

   private async markError(input: {
      captureId: string;
      sessionId: string;
      startedAtMs: number;
      errorMessage: string;
      extra?: Record<string, unknown>;
   }) {
      const processingMs = Math.max(0, Date.now() - input.startedAtMs);

      await this.prisma.correctionCapture.update({
         where: { id: input.captureId },
         data: {
            status: 'error',
            reviewReasons: [CorrectionCaptureReviewReason.omr_error],
            errorMessage: input.errorMessage,
            processingMs,
            detectionPayload: input.extra ? this.toJson(input.extra) : undefined,
         },
      });

      await this.publisher.publish({
         sessionId: input.sessionId,
         captureId: input.captureId,
         stage: CorrectionEventStageEnum.CAPTURE_ERROR,
         durationMs: processingMs,
         payload: {
            captureId: input.captureId,
            errorMessage: input.errorMessage,
            ...input.extra,
         },
      });

      await this.metrics.refreshSessionMetrics(input.sessionId);
   }

   private async saveBase64Artifact(
      base64: string | undefined,
      folder: string,
   ): Promise<string | undefined> {
      if (!base64 || base64.trim().length === 0) return undefined;

      return this.storage.saveFileFromBase64(base64, folder);
   }

   private toJson(value: unknown): Prisma.InputJsonValue {
      return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
   }
}
