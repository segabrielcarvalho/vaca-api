import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { QUEUES } from '../../../queue/constants/queue.constants';
import { PrismaService } from '../../../prisma/prisma.service';
import { CorrectionEventStageEnum } from '../../enums/correction-event-stage.enum';
import { RequeueCorrectionCaptureInput } from '../../inputs/requeue-correction-capture.input';
import { CorrectionJobPayload } from '../../objects/correction-job-payload.object';
import { CorrectionPublisherService } from '../correction-publisher.service';
import { CorrectionAccessService } from '../shared/correction-access.service';
import { CorrectionMetricsService } from '../shared/correction-metrics.service';

@Injectable()
export class RequeueCorrectionCaptureService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly access: CorrectionAccessService,
      private readonly metrics: CorrectionMetricsService,
      private readonly publisher: CorrectionPublisherService,
      @InjectQueue(QUEUES.CORRECTION_OMR)
      private readonly correctionQueue: Queue<CorrectionJobPayload>,
   ) {}

   async run(input: RequeueCorrectionCaptureInput, user: AuthCurrentUser) {
      const captureRef = await this.access.assertCapturePermission(
         input.captureId,
         user,
         'klass.correction.run',
      );

      const current = await this.prisma.correctionCapture.findUniqueOrThrow({
         where: { id: captureRef.id },
         select: {
            id: true,
            sessionId: true,
            threshold: true,
            delta: true,
         },
      });

      const threshold = input.threshold ?? current.threshold ?? 0.5;
      const delta = input.delta ?? current.delta ?? 0.12;

      const updated = await this.prisma.correctionCapture.update({
         where: { id: captureRef.id },
         data: {
            status: 'queued',
            errorMessage: null,
            reviewNotes: null,
            reviewReasons: [],
            resolvedByAgentId: null,
            resolvedAt: null,
            threshold,
            delta,
         },
      });

      await this.correctionQueue.add(
         'omr-process',
         {
            captureId: current.id,
            sessionId: current.sessionId,
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
         sessionId: current.sessionId,
         captureId: current.id,
         stage: CorrectionEventStageEnum.CAPTURE_REQUEUED,
         payload: {
            captureId: current.id,
            threshold,
            delta,
         },
      });

      await this.metrics.refreshSessionMetrics(current.sessionId);

      return updated;
   }
}
