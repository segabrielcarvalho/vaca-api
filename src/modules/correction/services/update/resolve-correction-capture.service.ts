import { BadRequestException, Injectable } from '@nestjs/common';
import { CorrectionCaptureStatus } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CorrectionEventStageEnum } from '../../enums/correction-event-stage.enum';
import { ResolveCorrectionCaptureInput } from '../../inputs/resolve-correction-capture.input';
import { CorrectionPublisherService } from '../correction-publisher.service';
import { CorrectionAccessService } from '../shared/correction-access.service';
import { CorrectionMetricsService } from '../shared/correction-metrics.service';

const ALLOWED_FINAL_STATUS: CorrectionCaptureStatus[] = [
   CorrectionCaptureStatus.graded,
   CorrectionCaptureStatus.needs_review,
   CorrectionCaptureStatus.error,
];

@Injectable()
export class ResolveCorrectionCaptureService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly access: CorrectionAccessService,
      private readonly scopedAccessService: ScopedAccessService,
      private readonly metrics: CorrectionMetricsService,
      private readonly publisher: CorrectionPublisherService,
   ) {}

   async run(input: ResolveCorrectionCaptureInput, user: AuthCurrentUser) {
      const captureRef = await this.access.assertCapturePermission(
         input.captureId,
         user,
         'klass.correction.review',
      );

      if (!ALLOWED_FINAL_STATUS.includes(input.status)) {
         throw new BadRequestException(
            'Status inválido para resolução manual do capture.',
         );
      }

      const resolvedByAgentId = await this.scopedAccessService.getAgentIdByUserId(user.id);

      const updated = await this.prisma.correctionCapture.update({
         where: { id: captureRef.id },
         data: {
            status: input.status,
            reviewReasons: input.reviewReasons,
            reviewNotes: input.reviewNotes?.trim() || null,
            resolvedByAgentId,
            resolvedAt: new Date(),
         },
      });

      await this.publisher.publish({
         sessionId: captureRef.sessionId,
         captureId: captureRef.id,
         stage: CorrectionEventStageEnum.CAPTURE_RESOLVED,
         payload: {
            captureId: captureRef.id,
            status: input.status,
            reviewReasons: input.reviewReasons,
         },
      });

      await this.metrics.refreshSessionMetrics(captureRef.sessionId);

      return updated;
   }
}
