import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { ConfigType } from '@nestjs/config';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { MyLogger } from '../../../logger/my-logger.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { QUEUES } from '../../../queue/constants/queue.constants';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../../storage/providers';
import type IS3Provider from '../../../storage/providers/s3/s3.interface';
import correctionConfig from '../../config/correction.config';
import { CorrectionEventStageEnum } from '../../enums/correction-event-stage.enum';
import { SubmitCorrectionPhotoInput } from '../../inputs/submit-correction-photo.input';
import { CorrectionJobPayload } from '../../objects/correction-job-payload.object';
import { CorrectionPublisherService } from '../correction-publisher.service';
import { CorrectionAccessService } from '../shared/correction-access.service';
import { CorrectionMetricsService } from '../shared/correction-metrics.service';

type UploadFileLike = {
   createReadStream: () => NodeJS.ReadableStream;
};

type ResolvedImageBuffer = {
   buffer: Buffer;
   source: 'photoBase64' | 'photoFile';
   base64Length?: number;
};

type UploadReference = UploadFileLike | Promise<UploadFileLike> | undefined;
const MAX_CORRECTION_IMAGE_BYTES = 15 * 1024 * 1024;
const BASE64_REGEX = /^[A-Za-z0-9+/=\s]+$/;

@Injectable()
export class SubmitCorrectionPhotoService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly scopedAccessService: ScopedAccessService,
      private readonly access: CorrectionAccessService,
      private readonly publisher: CorrectionPublisherService,
      private readonly metrics: CorrectionMetricsService,
      @Inject(STORAGE_PROVIDER)
      private readonly storage: IS3Provider,
      @InjectQueue(QUEUES.CORRECTION_OMR)
      private readonly correctionQueue: Queue<CorrectionJobPayload>,
      @Inject(correctionConfig.KEY)
      private readonly config: ConfigType<typeof correctionConfig>,
   ) {}

   async run(input: SubmitCorrectionPhotoInput, user: AuthCurrentUser) {
      this.logger.setContext(SubmitCorrectionPhotoService.name);
      if (this.config.debugTrace) {
         this.logger.setLogLevels(['log', 'error', 'warn', 'debug', 'verbose']);
      }
      this.trace('submit_correction_photo.received', {
         userId: user.id,
         sessionId: input.sessionId,
         hasPhotoBase64: Boolean(input.photoBase64),
         hasPhotoFile: Boolean(input.photoFile),
      });

      const sessionRef = await this.access.assertSessionPermission(
         input.sessionId,
         user,
         'klass.correction.run',
      );

      const session = await this.prisma.correctionSession.findUniqueOrThrow({
         where: { id: sessionRef.id },
         select: {
            id: true,
            status: true,
            examId: true,
         },
      });

      if (session.status !== 'running') {
         throw new BadRequestException(
            'A sessão de correção não está em execução.',
         );
      }

      this.trace('submit_correction_photo.session_validated', {
         sessionId: session.id,
         examId: session.examId,
         status: session.status,
      });

      const [{ buffer, source, base64Length }, submittedByAgentId] =
         await Promise.all([
            this.resolveImageBuffer(input),
            this.scopedAccessService.getAgentIdByUserId(user.id),
         ]);

      this.trace('submit_correction_photo.buffer_ready', {
         sessionId: session.id,
         examId: session.examId,
         userId: user.id,
         submittedByAgentId,
         source,
         base64Length,
         bufferBytes: buffer.byteLength,
      });

      if (buffer.byteLength === 0) {
         throw new BadRequestException('Imagem da correção vazia.');
      }

      const originalImagePath = await this.storage.saveFileFromBuffer(
         buffer,
         `corrections/sessions/${session.id}/original`,
      );

      const threshold = input.threshold ?? 0.5;
      const delta = input.delta ?? 0.12;

      const capture = await this.prisma.correctionCapture.create({
         data: {
            sessionId: session.id,
            examId: session.examId,
            submittedByAgentId,
            status: 'queued',
            originalImagePath,
            threshold,
            delta,
         },
      });

      this.trace('submit_correction_photo.capture_created', {
         captureId: capture.id,
         sessionId: session.id,
         examId: session.examId,
         threshold,
         delta,
      });

      const queueJob = await this.correctionQueue.add(
         'omr-process',
         {
            captureId: capture.id,
            sessionId: session.id,
            threshold,
            delta,
         },
         {
            attempts: 3,
            backoff: {
               type: 'exponential',
               delay: 1000,
            },
            removeOnComplete: true,
            removeOnFail: false,
         },
      );

      this.trace('submit_correction_photo.job_enqueued', {
         captureId: capture.id,
         sessionId: session.id,
         examId: session.examId,
         queueJobId: queueJob.id,
      });

      await this.publisher.publish({
         sessionId: session.id,
         captureId: capture.id,
         stage: CorrectionEventStageEnum.CAPTURE_QUEUED,
         payload: {
            captureId: capture.id,
            threshold,
            delta,
         },
      });

      this.trace('submit_correction_photo.capture_queued_published', {
         captureId: capture.id,
         sessionId: session.id,
         stage: CorrectionEventStageEnum.CAPTURE_QUEUED,
      });

      await this.metrics.refreshSessionMetrics(session.id);

      return capture;
   }

   private async resolveImageBuffer(
      input: SubmitCorrectionPhotoInput,
   ): Promise<ResolvedImageBuffer> {
      if (input.photoBase64) {
         const clean = input.photoBase64.replace(/^data:.+;base64,/, '');
         if (!clean.trim()) {
            throw new BadRequestException('photoBase64 inválido.');
         }

         if (!BASE64_REGEX.test(clean)) {
            throw new BadRequestException('photoBase64 inválido.');
         }

         let buffer: Buffer;
         try {
            buffer = Buffer.from(clean, 'base64');
         } catch {
            throw new BadRequestException('photoBase64 inválido.');
         }

         this.assertImageSize(buffer);
         return {
            buffer,
            source: 'photoBase64',
            base64Length: clean.length,
         };
      }

      const upload = await this.resolveUpload(
         input.photoFile as UploadReference,
      );
      if (!upload) {
         throw new BadRequestException(
            'Informe photoFile ou photoBase64 para enviar a folha.',
         );
      }

      const buffer = await this.toBuffer(upload.createReadStream());
      this.assertImageSize(buffer);
      return {
         buffer,
         source: 'photoFile',
      };
   }

   private async resolveUpload(
      fileRef: UploadReference,
   ): Promise<UploadFileLike | undefined> {
      if (!fileRef) return undefined;

      const resolved = await fileRef;
      if (!resolved || typeof resolved.createReadStream !== 'function') {
         throw new BadRequestException('Arquivo de upload inválido.');
      }

      return resolved;
   }

   private async toBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
      return new Promise((resolve, reject) => {
         const chunks: Buffer[] = [];
         let totalBytes = 0;
         let hasFailed = false;

         const fail = (error: Error) => {
            if (hasFailed) return;
            hasFailed = true;
            reject(error);
         };

         stream.on('data', (chunk) => {
            if (hasFailed) return;
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            totalBytes += buffer.byteLength;
            if (totalBytes > MAX_CORRECTION_IMAGE_BYTES) {
               fail(
                  new BadRequestException(
                     `Imagem excede o limite de ${Math.floor(
                        MAX_CORRECTION_IMAGE_BYTES / (1024 * 1024),
                     )}MB.`,
                  ),
               );
               return;
            }

            chunks.push(buffer);
         });
         stream.on('error', (error) => fail(error as Error));
         stream.on('end', () => {
            if (hasFailed) return;
            resolve(Buffer.concat(chunks));
         });
      });
   }

   private assertImageSize(buffer: Buffer) {
      if (buffer.byteLength > MAX_CORRECTION_IMAGE_BYTES) {
         throw new BadRequestException(
            `Imagem excede o limite de ${Math.floor(
               MAX_CORRECTION_IMAGE_BYTES / (1024 * 1024),
            )}MB.`,
         );
      }
   }

   private trace(event: string, meta?: Record<string, unknown>) {
      if (!this.config.debugTrace) return;
      this.logger.debug(event, JSON.parse(JSON.stringify(meta ?? null)) as any);
   }
}
