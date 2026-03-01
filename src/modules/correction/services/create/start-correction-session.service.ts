import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CorrectionEventStageEnum } from '../../enums/correction-event-stage.enum';
import { StartCorrectionSessionInput } from '../../inputs/start-correction-session.input';
import { CorrectionPublisherService } from '../correction-publisher.service';
import { CorrectionAccessService } from '../shared/correction-access.service';

@Injectable()
export class StartCorrectionSessionService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
      private readonly access: CorrectionAccessService,
      private readonly publisher: CorrectionPublisherService,
   ) {}

   async run(input: StartCorrectionSessionInput, user: AuthCurrentUser) {
      const exam = await this.access.assertExamPermission(
         input.examId,
         user,
         'klass.correction.run',
      );

      const startedByAgentId = await this.scopedAccessService.getAgentIdByUserId(user.id);

      const session = await this.prisma.correctionSession.create({
         data: {
            examId: exam.id,
            startedByAgentId,
            status: 'running',
         },
      });

      await this.publisher.publish({
         sessionId: session.id,
         stage: CorrectionEventStageEnum.SESSION_STARTED,
         payload: {
            examId: exam.id,
            startedByAgentId,
         },
      });

      return this.prisma.correctionSession.findUniqueOrThrow({
         where: { id: session.id },
      });
   }
}
