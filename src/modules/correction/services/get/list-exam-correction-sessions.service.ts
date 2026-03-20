import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListExamCorrectionSessionsInput } from '../../inputs/list-exam-correction-sessions.input';
import { CorrectionAccessService } from '../shared/correction-access.service';

@Injectable()
export class ListExamCorrectionSessionsService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly access: CorrectionAccessService,
   ) {}

   async run(input: ListExamCorrectionSessionsInput, user: AuthCurrentUser) {
      await this.access.assertExamPermission(
         input.examId,
         user,
         'klass.correction.read',
      );

      const skip = input.skip ?? 0;
      const take = input.take ?? 20;
      const where = {
         examId: input.examId,
      };

      const [count, rows] = await Promise.all([
         this.prisma.correctionSession.count({ where }),
         this.prisma.correctionSession.findMany({
            where,
            skip,
            take,
            orderBy: [{ startedAt: 'desc' }],
         }),
      ]);

      return { count, rows };
   }
}
