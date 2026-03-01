import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CorrectionEventStageEnum } from '../../enums/correction-event-stage.enum';
import { CompleteCorrectionSessionInput } from '../../inputs/complete-correction-session.input';
import { CorrectionPublisherService } from '../correction-publisher.service';
import { CorrectionAccessService } from '../shared/correction-access.service';
import { CorrectionMetricsService } from '../shared/correction-metrics.service';

@Injectable()
export class CompleteCorrectionSessionService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly access: CorrectionAccessService,
      private readonly publisher: CorrectionPublisherService,
      private readonly metrics: CorrectionMetricsService,
   ) {}

   async run(input: CompleteCorrectionSessionInput, user: AuthCurrentUser) {
      const session = await this.access.assertSessionPermission(
         input.sessionId,
         user,
         'klass.correction.run',
      );

      if (session.id !== input.sessionId) {
         throw new BadRequestException('Sessão inválida.');
      }

      const updated = await this.prisma.correctionSession.update({
         where: { id: session.id },
         data: {
            status: 'completed',
            finishedAt: new Date(),
         },
      });

      await this.publisher.publish({
         sessionId: session.id,
         stage: CorrectionEventStageEnum.SESSION_COMPLETED,
         payload: {
            sessionId: session.id,
         },
      });

      await this.metrics.refreshSessionMetrics(session.id);

      return updated;
   }
}
