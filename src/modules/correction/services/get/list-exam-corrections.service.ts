import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListExamCorrectionsInput } from '../../inputs/list-exam-corrections.input';
import { CorrectionAccessService } from '../shared/correction-access.service';

@Injectable()
export class ListExamCorrectionsService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly access: CorrectionAccessService,
   ) {}

   async run(input: ListExamCorrectionsInput, user: AuthCurrentUser) {
      await this.access.assertExamPermission(
         input.examId,
         user,
         'klass.correction.read',
      );

      const skip = input.skip ?? 0;
      const take = input.take ?? 20;
      const where = {
         examId: input.examId,
         isActive: true,
      };

      const [count, rows] = await Promise.all([
         this.prisma.correctionExam.count({ where }),
         this.prisma.correctionExam.findMany({
            where,
            skip,
            take,
            orderBy: [{ createdAt: 'desc' }],
            include: {
               Items: {
                  orderBy: {
                     Question: {
                        number: 'asc',
                     },
                  },
               },
            },
         }),
      ]);

      return { count, rows };
   }
}
