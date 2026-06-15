import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { ConfigType } from '@nestjs/config';
import {
   CorrectionCaptureReviewReason,
   Prisma,
} from '../../../../.prisma/client';
import sharp from 'sharp';
import correctionConfig from '../config/correction.config';
import { MyLogger } from '../../logger/my-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES } from '../../queue/constants/queue.constants';
import { STORAGE_PROVIDER } from '../../storage/providers';
import type IS3Provider from '../../storage/providers/s3/s3.interface';
import { CorrectionEventStageEnum } from '../enums/correction-event-stage.enum';
import type { CorrectionJobPayload } from '../objects/correction-job-payload.object';
import { CorrectionPublisherService } from '../services/correction-publisher.service';
import { CorrectionCaptureArtifactCleanupService } from '../services/shared/correction-capture-artifact-cleanup.service';
import { CorrectionExamActivationService } from '../services/shared/correction-exam-activation.service';
import { CorrectionMetricsService } from '../services/shared/correction-metrics.service';

type OmrProcessResponse = {
   success?: boolean;
   engineVersion?: string;
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
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly publisher: CorrectionPublisherService,
      private readonly correctionExamActivation: CorrectionExamActivationService,
      private readonly artifactCleanup: CorrectionCaptureArtifactCleanupService,
      private readonly metrics: CorrectionMetricsService,
      @Inject(STORAGE_PROVIDER)
      private readonly storage: IS3Provider,
      @Inject(correctionConfig.KEY)
      private readonly config: ConfigType<typeof correctionConfig>,
   ) {
      super();
      this.logger.setContext(CorrectionOmrProcessor.name);
   }

   async process(job: Job<CorrectionJobPayload>): Promise<void> {
      const startedAtMs = Date.now();
      const { captureId, sessionId, threshold, delta } = job.data;
      this.trace('correction_omr.job_started', {
         jobId: job.id,
         captureId,
         sessionId,
         threshold,
         delta,
      });

      const capture = await this.prisma.correctionCapture.findUnique({
         where: { id: captureId },
         include: {
            Exam: {
               include: {
                  Klass: {
                     include: {
                        Course: true,
                     },
                  },
                  Questions: {
                     orderBy: { number: 'asc' },
                  },
                  TemplateVersion: true,
               },
            },
         },
      });

      if (!capture) {
         this.trace('correction_omr.capture_not_found', {
            jobId: job.id,
            captureId,
            sessionId,
         });
         return;
      }

      const queueLatencyMs = Math.max(
         0,
         Date.now() - capture.createdAt.getTime(),
      );

      await this.prisma.correctionCapture.update({
         where: { id: capture.id },
         data: {
            status: 'processing',
            queueLatencyMs,
         },
      });

      this.trace('correction_omr.capture_processing', {
         jobId: job.id,
         captureId,
         sessionId,
         queueLatencyMs,
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
      this.trace('correction_omr.capture_processing_published', {
         jobId: job.id,
         captureId,
         sessionId,
         queueLatencyMs,
      });

      if (!capture.Exam.TemplateVersion) {
         await this.markNeedsReview({
            captureId,
            sessionId,
            examId: capture.examId,
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
         this.trace('correction_omr.original_downloaded', {
            jobId: job.id,
            captureId,
            sessionId,
            originalImageBytes: originalBuffer.byteLength,
         });
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
         const masterAnswers = capture.Exam.Questions.map((question) =>
            Number.isInteger(question.correct) ? question.correct : null,
         );
         const omrEndpoint = `${this.config.omrBaseUrl.replace(/\/$/, '')}/api/v2/omr/process`;
         this.trace('correction_omr.omr_request_started', {
            jobId: job.id,
            captureId,
            sessionId,
            threshold,
            delta,
            questionCount: capture.Exam.Questions.length,
            timeoutMs: this.config.omrRequestTimeoutMs,
            omrEndpoint,
            originalImageBytes: originalBuffer.byteLength,
         });
         this.operationalLog('correction_omr.omr_request_started', {
            jobId: job.id,
            captureId,
            sessionId,
            questionCount: capture.Exam.Questions.length,
            timeoutMs: this.config.omrRequestTimeoutMs,
            omrEndpoint,
            originalImageBytes: originalBuffer.byteLength,
         });
         const controller = new AbortController();
         const requestStartedAtMs = Date.now();
         const timeout = setTimeout(() => {
            controller.abort();
         }, this.config.omrRequestTimeoutMs);

         try {
            const response = await fetch(omrEndpoint, {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
               },
               body: JSON.stringify({
                  captureId,
                  sessionId,
                  imageBase64: originalBuffer.toString('base64'),
                  compiledGeometryJson:
                     capture.Exam.TemplateVersion.compiledGeometryJson,
                  masterAnswers,
                  threshold,
                  delta,
               }),
               signal: controller.signal,
            });
            const httpDurationMs = Math.max(0, Date.now() - requestStartedAtMs);

            this.operationalLog('correction_omr.omr_http_response', {
               jobId: job.id,
               captureId,
               sessionId,
               status: response.status,
               ok: response.ok,
               durationMs: httpDurationMs,
               timeoutMs: this.config.omrRequestTimeoutMs,
            });

            if (!response.ok) {
               throw new Error(`OMR retornou HTTP ${response.status}.`);
            }

            omrResponse = (await response.json()) as OmrProcessResponse;
            const responseDurationMs = Math.max(
               0,
               Date.now() - requestStartedAtMs,
            );
            this.trace('correction_omr.omr_response_received', {
               jobId: job.id,
               captureId,
               sessionId,
               success: omrResponse.success ?? false,
               engineVersion: omrResponse.engineVersion ?? 'unknown',
               registrationStatus: omrResponse.registration?.status ?? null,
               answersCount: Array.isArray(omrResponse.answers)
                  ? omrResponse.answers.length
                  : Array.isArray(omrResponse.answers_numeric)
                    ? omrResponse.answers_numeric.length
                    : 0,
               requestDurationMs: responseDurationMs,
               omrTotalMs: omrResponse.timings?.totalMs ?? null,
            });
            this.operationalLog('correction_omr.omr_response_received', {
               jobId: job.id,
               captureId,
               sessionId,
               success: omrResponse.success ?? false,
               engineVersion: omrResponse.engineVersion ?? 'unknown',
               registrationStatus: omrResponse.registration?.status ?? null,
               answersCount: Array.isArray(omrResponse.answers)
                  ? omrResponse.answers.length
                  : Array.isArray(omrResponse.answers_numeric)
                    ? omrResponse.answers_numeric.length
                    : 0,
               requestDurationMs: responseDurationMs,
               omrTotalMs: omrResponse.timings?.totalMs ?? null,
            });
         } finally {
            clearTimeout(timeout);
         }
      } catch (error) {
         this.operationalLog('correction_omr.omr_request_failed', {
            jobId: job.id,
            captureId,
            sessionId,
            errorName: (error as Error).name,
            errorMessage: (error as Error).message,
            timedOut:
               (error as Error).name === 'AbortError' ||
               (error as Error).message === 'This operation was aborted',
            timeoutMs: this.config.omrRequestTimeoutMs,
         });
         await this.markError({
            captureId,
            sessionId,
            startedAtMs,
            errorMessage: 'Falha de comunicação com o motor OMR.',
            extra: { error: (error as Error).message },
         });
         return;
      }

      try {
         const detectionPayload = this.toJson({
            timings: omrResponse.timings ?? null,
         });
         const omrPayload = this.toJson(omrResponse);

         const overlayImagePath = await this.saveReviewPreviewArtifact({
            captureId,
            sessionId,
            overlayBase64: omrResponse.images?.overlayBase64,
            originalImagePath: capture.originalImagePath,
         });
         const rectifiedImagePath = undefined;

         this.trace('correction_omr.artifacts_processed', {
            jobId: job.id,
            captureId,
            sessionId,
            hasRectifiedImage: Boolean(rectifiedImagePath),
            hasOverlayImage: Boolean(overlayImagePath),
         });

         if (!omrResponse.success) {
            await this.discardCapture({
               captureId,
               sessionId,
               startedAtMs,
               reason: 'omr_unreadable',
               message:
                  omrResponse.error?.message ||
                  'OMR não conseguiu ler a folha.',
               originalImagePath: capture.originalImagePath,
               overlayImagePath,
            });
            return;
         }

         const registrationStatus = (omrResponse.registration?.status || '')
            .trim()
            .toLowerCase();
         if (registrationStatus === 'ambiguous') {
            await this.discardCapture({
               captureId,
               sessionId,
               startedAtMs,
               reason: 'registration_ambiguous',
               message: 'Matrícula ambígua na folha.',
               originalImagePath: capture.originalImagePath,
               overlayImagePath,
            });
            return;
         }

         const registrationNumber = omrResponse.registration?.value ?? null;
         this.trace('correction_omr.registration_resolved', {
            jobId: job.id,
            captureId,
            sessionId,
            registrationStatus,
            hasRegistrationNumber: Boolean(registrationNumber),
         });

         if (!registrationNumber) {
            await this.discardCapture({
               captureId,
               sessionId,
               startedAtMs,
               reason: 'registration_missing',
               message: 'Matrícula não identificada na folha.',
               originalImagePath: capture.originalImagePath,
               overlayImagePath,
            });
            return;
         }

         const student = await this.prisma.student.findUnique({
            where: {
               schoolId_registrationNumber: {
                  schoolId: capture.Exam.Klass.Course.schoolId,
                  registrationNumber,
               },
            },
            select: { id: true },
         });
         this.trace('correction_omr.student_lookup_finished', {
            jobId: job.id,
            captureId,
            sessionId,
            registrationNumber,
            studentId: student?.id ?? null,
         });

         if (!student) {
            await this.discardCapture({
               captureId,
               sessionId,
               startedAtMs,
               reason: 'registration_student_missing',
               message: 'Matrícula não encontrada na base para esta correção.',
               originalImagePath: capture.originalImagePath,
               overlayImagePath,
            });
            return;
         }

         const answers = this.normalizeAnswers(
            omrResponse,
            capture.Exam.Questions.length,
         );
         this.trace('correction_omr.answers_normalized', {
            jobId: job.id,
            captureId,
            sessionId,
            questionCount: capture.Exam.Questions.length,
            hasAmbiguity: answers.hasAmbiguity,
            answeredCount: answers.values.filter((value) => value !== null)
               .length,
         });

         if (answers.hasAmbiguity) {
            await this.markNeedsReview({
               captureId,
               sessionId,
               examId: capture.examId,
               startedAtMs,
               reason: CorrectionCaptureReviewReason.answer_ambiguous,
               errorMessage: 'Folha com ambiguidades de marcação.',
               rectifiedImagePath: undefined,
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
            capture.Exam.Questions.map((question) => [
               question.number,
               question,
            ]),
         );

         let score = 0;
         let correctAnswersCount = 0;
         const correctionItems: Array<{
            questionId: string;
            selected: number | null;
            isCorrect: boolean | null;
         }> = [];

         for (
            let number = 1;
            number <= capture.Exam.Questions.length;
            number += 1
         ) {
            const question = questionMap.get(number);
            if (!question) continue;

            const selected = answers.values[number - 1] ?? null;
            const isCorrect =
               selected === null ? null : selected === question.correct;

            if (isCorrect) {
               score += question.value;
               correctAnswersCount += 1;
            }

            correctionItems.push({
               questionId: question.id,
               selected,
               isCorrect,
            });
         }

         const processingMs = Math.max(0, Date.now() - startedAtMs);
         this.trace('correction_omr.grading_computed', {
            jobId: job.id,
            captureId,
            sessionId,
            score,
            correctAnswersCount,
            correctionItemCount: correctionItems.length,
            processingMs,
         });

         const correctionResult = await this.prisma.$transaction(
            async (tx) => {
               this.trace('correction_omr.transaction_started', {
                  jobId: job.id,
                  captureId,
                  sessionId,
                  studentId: student.id,
               });
               const createdCorrection =
                  await this.correctionExamActivation.upsertOfficialCorrection(
                     tx,
                     {
                        examId: capture.examId,
                        studentId: student.id,
                        filePath: overlayImagePath ?? capture.originalImagePath,
                        score,
                        status: 'graded',
                        metadata: {
                           source: 'omr_v2',
                           captureId,
                           omrEngineVersion:
                              omrResponse.engineVersion ?? 'unknown',
                        } as Prisma.InputJsonValue,
                        preserveCaptureId: capture.id,
                     },
                  );
               this.trace('correction_omr.correction_exam_upserted', {
                  jobId: job.id,
                  captureId,
                  sessionId,
                  correctionId: createdCorrection.correction.id,
                  replacedSessionIds: createdCorrection.replacedSessionIds,
               });

               await tx.correctionQuestion.deleteMany({
                  where: { correctionId: createdCorrection.correction.id },
               });

               await tx.correctionQuestion.createMany({
                  data: correctionItems.map((item) => ({
                     correctionId: createdCorrection.correction.id,
                     questionId: item.questionId,
                     selected: item.selected,
                     isCorrect: item.isCorrect,
                  })),
               });
               this.trace('correction_omr.questions_persisted', {
                  jobId: job.id,
                  captureId,
                  sessionId,
                  correctionId: createdCorrection.correction.id,
                  questionCount: correctionItems.length,
               });

               await tx.correctionCapture.update({
                  where: { id: capture.id },
                  data: {
                     status: 'graded',
                     reviewReasons: [],
                     reviewNotes: null,
                     errorMessage: null,
                     correctionExamId: createdCorrection.correction.id,
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
               this.trace('correction_omr.capture_marked_graded', {
                  jobId: job.id,
                  captureId,
                  sessionId,
                  correctionId: createdCorrection.correction.id,
               });

               return createdCorrection;
            },
            {
               isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
         );

         this.trace('correction_omr.capture_graded', {
            jobId: job.id,
            captureId,
            sessionId,
            correctionId: correctionResult.correction.id,
            correctAnswersCount,
            questionCount: capture.Exam.Questions.length,
            score,
            processingMs,
         });
         this.operationalLog('correction_omr.capture_graded', {
            jobId: job.id,
            captureId,
            sessionId,
            correctionId: correctionResult.correction.id,
            correctAnswersCount,
            questionCount: capture.Exam.Questions.length,
            score,
            processingMs,
         });

         await this.artifactCleanup.cleanupReplacedCaptureArtifacts({
            replacedCaptureArtifacts: correctionResult.replacedCaptureArtifacts,
            preservedPaths: [
               overlayImagePath ?? capture.originalImagePath,
               rectifiedImagePath,
            ],
            source: 'correction_omr',
         });

         await this.publisher.publish({
            sessionId,
            captureId,
            stage: CorrectionEventStageEnum.CAPTURE_GRADED,
            durationMs: processingMs,
            payload: {
               captureId,
               correctionId: correctionResult.correction.id,
               correctAnswersCount,
               questionCount: capture.Exam.Questions.length,
               score,
               registrationNumber,
            },
         });
         this.trace('correction_omr.capture_graded_published', {
            jobId: job.id,
            captureId,
            sessionId,
            correctionId: correctionResult.correction.id,
         });

         await this.refreshSessionsMetrics([
            sessionId,
            ...correctionResult.replacedSessionIds,
         ]);
      } catch (error) {
         await this.markError({
            captureId,
            sessionId,
            startedAtMs,
            errorMessage: 'Falha ao persistir resultado da correção.',
            extra: {
               stage: 'post_omr_finalize',
               error: (error as Error).message,
            },
         });
      }
   }

   private normalizeAnswers(omr: OmrProcessResponse, questionCount: number) {
      if (Array.isArray(omr.answers) && omr.answers.length > 0) {
         const values = Array.from(
            { length: questionCount },
            () => null as number | null,
         );
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
               typeof answer.selected === 'number' &&
               answer.selected >= 1 &&
               answer.selected <= 5
                  ? answer.selected
                  : null;

            values[questionIndex] = selected;
         }

         return { values, hasAmbiguity };
      }

      const picks = Array.isArray(omr.answers_numeric)
         ? omr.answers_numeric
         : [];
      const values = Array.from(
         { length: questionCount },
         () => null as number | null,
      );
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

   private async markNeedsReview(input: {
      captureId: string;
      sessionId: string;
      examId: string;
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
      this.trace('correction_omr.mark_needs_review_started', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         reason: input.reason,
         processingMs,
         hasRegistrationNumber: Boolean(input.registrationNumber),
         studentId: input.studentId ?? null,
      });

      await this.prisma.$transaction(async (tx) => {
         if (input.studentId) {
            await this.correctionExamActivation.invalidateOtherPendingReviewCaptures(
               tx,
               {
                  examId: input.examId,
                  studentId: input.studentId,
                  preserveCaptureId: input.captureId,
               },
            );
         }

         await tx.correctionCapture.update({
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
      });
      this.trace('correction_omr.mark_needs_review_capture_updated', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         reason: input.reason,
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
      this.trace('correction_omr.mark_needs_review_published', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         reason: input.reason,
      });

      this.trace('correction_omr.capture_needs_review', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         reason: input.reason,
         processingMs,
         errorMessage: input.errorMessage,
      });
      this.operationalLog('correction_omr.capture_needs_review', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         reason: input.reason,
         processingMs,
         errorMessage: input.errorMessage,
      });

      await this.refreshMetricsSafely(input.sessionId);
   }

   private async discardCapture(input: {
      captureId: string;
      sessionId: string;
      startedAtMs: number;
      reason:
         | 'omr_unreadable'
         | 'registration_ambiguous'
         | 'registration_missing'
         | 'registration_student_missing';
      message: string;
      originalImagePath?: string;
      rectifiedImagePath?: string;
      overlayImagePath?: string;
   }) {
      const processingMs = Math.max(0, Date.now() - input.startedAtMs);
      this.trace('correction_omr.discard_capture_started', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         reason: input.reason,
         processingMs,
      });
      const artifactPaths = Array.from(
         new Set(
            [
               input.originalImagePath,
               input.rectifiedImagePath,
               input.overlayImagePath,
            ].filter(
               (path): path is string =>
                  Boolean(path) && !path.startsWith('purged:'),
            ),
         ),
      );
      this.trace('correction_omr.discard_capture_artifacts_resolved', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         artifactPaths,
      });

      const artifactDeletionResults = await Promise.allSettled(
         artifactPaths.map((path) => this.storage.deleteFile(path)),
      );
      this.trace('correction_omr.discard_capture_artifacts_deleted', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         artifactDeletionResults: artifactDeletionResults.map(
            (result, index) => ({
               path: artifactPaths[index],
               status: result.status,
               reason:
                  result.status === 'rejected'
                     ? result.reason instanceof Error
                        ? result.reason.message
                        : String(result.reason)
                     : null,
            }),
         ),
      });

      await this.prisma.$transaction(async (tx) => {
         this.trace('correction_omr.discard_capture_transaction_started', {
            captureId: input.captureId,
            sessionId: input.sessionId,
         });
         await tx.correctionSessionEvent.deleteMany({
            where: {
               captureId: input.captureId,
            },
         });
         this.trace('correction_omr.discard_capture_events_deleted', {
            captureId: input.captureId,
            sessionId: input.sessionId,
         });

         await tx.correctionCapture.delete({
            where: {
               id: input.captureId,
            },
         });
         this.trace('correction_omr.discard_capture_deleted', {
            captureId: input.captureId,
            sessionId: input.sessionId,
         });
      });

      this.trace('correction_omr.capture_discarded', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         reason: input.reason,
         processingMs,
         message: input.message,
      });
      this.operationalLog('correction_omr.capture_discarded', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         reason: input.reason,
         processingMs,
         message: input.message,
      });

      await this.publisher.publish({
         sessionId: input.sessionId,
         captureId: input.captureId,
         stage: CorrectionEventStageEnum.CAPTURE_DISCARDED,
         durationMs: processingMs,
         payload: {
            captureId: input.captureId,
            reason: input.reason,
            errorMessage: input.message,
         },
      });
      this.trace('correction_omr.capture_discarded_published', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         reason: input.reason,
      });

      await this.refreshSessionsMetrics([input.sessionId]);
   }

   private async markError(input: {
      captureId: string;
      sessionId: string;
      startedAtMs: number;
      errorMessage: string;
      extra?: Record<string, unknown>;
   }) {
      const processingMs = Math.max(0, Date.now() - input.startedAtMs);
      this.trace('correction_omr.mark_error_started', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         processingMs,
         errorMessage: input.errorMessage,
      });

      await this.prisma.correctionCapture.update({
         where: { id: input.captureId },
         data: {
            status: 'error',
            reviewReasons: [CorrectionCaptureReviewReason.omr_error],
            errorMessage: input.errorMessage,
            processingMs,
            detectionPayload: input.extra
               ? this.toJson(input.extra)
               : undefined,
         },
      });
      this.trace('correction_omr.mark_error_capture_updated', {
         captureId: input.captureId,
         sessionId: input.sessionId,
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
      this.trace('correction_omr.mark_error_published', {
         captureId: input.captureId,
         sessionId: input.sessionId,
      });

      this.trace('correction_omr.capture_error', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         processingMs,
         errorMessage: input.errorMessage,
      });
      this.operationalLog('correction_omr.capture_error', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         processingMs,
         errorMessage: input.errorMessage,
      });

      await this.refreshMetricsSafely(input.sessionId);
   }

   private async saveReviewPreviewArtifact(input: {
      captureId: string;
      sessionId: string;
      overlayBase64?: string;
      originalImagePath: string;
   }): Promise<string | undefined> {
      if (!input.overlayBase64 || input.overlayBase64.trim().length === 0) {
         this.trace('correction_omr.overlay_missing_using_original', {
            captureId: input.captureId,
            sessionId: input.sessionId,
            originalImagePath: input.originalImagePath,
         });
         return input.originalImagePath;
      }

      this.trace('correction_omr.overlay_optimization_started', {
         captureId: input.captureId,
         sessionId: input.sessionId,
      });
      const optimizedBuffer = await this.optimizeOverlay(input.overlayBase64);
      const key = `corrections/sessions/${input.sessionId}/captures/${input.captureId}/07_overlay_final.jpg`;

      await this.storage.saveFileFromBufferAtKey(
         optimizedBuffer,
         key,
         'image/jpeg',
      );
      this.trace('correction_omr.overlay_saved', {
         captureId: input.captureId,
         sessionId: input.sessionId,
         key,
         bytes: optimizedBuffer.byteLength,
      });

      try {
         await this.storage.deleteFile(input.originalImagePath);
         this.trace('correction_omr.original_deleted_after_overlay_save', {
            captureId: input.captureId,
            sessionId: input.sessionId,
            originalImagePath: input.originalImagePath,
         });
      } catch {
         this.trace(
            'correction_omr.original_delete_failed_after_overlay_save',
            {
               captureId: input.captureId,
               sessionId: input.sessionId,
               originalImagePath: input.originalImagePath,
            },
         );
         // ignore cleanup failures to avoid breaking the correction flow
      }

      await this.prisma.correctionCapture.update({
         where: { id: input.captureId },
         data: {
            originalImagePath: `purged:${input.captureId}`,
         },
      });
      this.trace('correction_omr.original_marked_purged', {
         captureId: input.captureId,
         sessionId: input.sessionId,
      });

      return key;
   }

   private async optimizeOverlay(base64: string) {
      const normalizedBase64 = base64.replace(/^data:.+;base64,/, '').trim();
      const buffer = Buffer.from(normalizedBase64, 'base64');

      return sharp(buffer)
         .rotate()
         .resize({
            width: 1600,
            height: 1600,
            fit: 'inside',
            withoutEnlargement: true,
         })
         .jpeg({
            quality: 72,
            mozjpeg: true,
         })
         .toBuffer();
   }

   private toJson(value: unknown): Prisma.InputJsonValue {
      return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
   }

   private trace(event: string, meta?: Record<string, unknown>) {
      if (!this.config.debugTrace) return;
      this.operationalLog(event, {
         trace: true,
         ...(meta ?? {}),
      });
   }

   private operationalLog(event: string, meta?: Record<string, unknown>) {
      this.logger.log(
         JSON.stringify({
            event,
            ...(meta ?? {}),
         }),
      );
   }

   private async refreshMetricsSafely(sessionId: string) {
      try {
         this.trace('correction_omr.metrics_refresh_started', {
            sessionId,
         });
         await this.metrics.refreshSessionMetrics(sessionId);
         this.trace('correction_omr.metrics_refresh_succeeded', {
            sessionId,
         });
      } catch (error) {
         this.trace('correction_omr.metrics_refresh_failed', {
            sessionId,
            error: (error as Error).message,
         });
      }
   }

   private async refreshSessionsMetrics(sessionIds: string[]) {
      this.trace('correction_omr.refresh_sessions_metrics_started', {
         sessionIds: Array.from(new Set(sessionIds)),
      });
      await Promise.all(
         Array.from(new Set(sessionIds)).map((sessionId) =>
            this.refreshMetricsSafely(sessionId),
         ),
      );
      this.trace('correction_omr.refresh_sessions_metrics_finished', {
         sessionIds: Array.from(new Set(sessionIds)),
      });
   }
}
