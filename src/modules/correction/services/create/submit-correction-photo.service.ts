import { InjectQueue } from '@nestjs/bullmq';
import {
   BadRequestException,
   Inject,
   Injectable,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { QUEUES } from '../../../queue/constants/queue.constants';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../../storage/providers';
import type IS3Provider from '../../../storage/providers/s3/s3.interface';
import { CorrectionEventStageEnum } from '../../enums/correction-event-stage.enum';
import { SubmitCorrectionPhotoInput } from '../../inputs/submit-correction-photo.input';
import { CorrectionJobPayload } from '../../objects/correction-job-payload.object';
import { CorrectionPublisherService } from '../correction-publisher.service';
import { CorrectionAccessService } from '../shared/correction-access.service';
import { CorrectionMetricsService } from '../shared/correction-metrics.service';

type UploadFileLike = {
   createReadStream: () => NodeJS.ReadableStream;
};

type UploadReference = UploadFileLike | Promise<UploadFileLike> | undefined;

@Injectable()
export class SubmitCorrectionPhotoService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
      private readonly access: CorrectionAccessService,
      private readonly publisher: CorrectionPublisherService,
      private readonly metrics: CorrectionMetricsService,
      @Inject(STORAGE_PROVIDER)
      private readonly storage: IS3Provider,
      @InjectQueue(QUEUES.CORRECTION_OMR)
      private readonly correctionQueue: Queue<CorrectionJobPayload>,
   ) {}

   async run(input: SubmitCorrectionPhotoInput, user: AuthCurrentUser) {
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
         throw new BadRequestException('A sessão de correção não está em execução.');
      }

      const [buffer, submittedByAgentId] = await Promise.all([
         this.resolveImageBuffer(input),
         this.scopedAccessService.getAgentIdByUserId(user.id),
      ]);

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

      await this.correctionQueue.add(
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

      await this.metrics.refreshSessionMetrics(session.id);

      return capture;
   }

   private async resolveImageBuffer(input: SubmitCorrectionPhotoInput): Promise<Buffer> {
      if (input.photoBase64) {
         const clean = input.photoBase64.replace(/^data:.+;base64,/, '');
         return Buffer.from(clean, 'base64');
      }

      const upload = await this.resolveUpload(input.photoFile as UploadReference);
      if (!upload) {
         throw new BadRequestException(
            'Informe photoFile ou photoBase64 para enviar a folha.',
         );
      }

      return this.toBuffer(upload.createReadStream());
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

         stream.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
         });
         stream.on('error', reject);
         stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
   }
}
