import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListCorrectionCapturesInput } from '../../inputs/list-correction-captures.input';
import { CorrectionAccessService } from '../shared/correction-access.service';

@Injectable()
export class ListCorrectionCapturesService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly access: CorrectionAccessService,
   ) {}

   async run(input: ListCorrectionCapturesInput, user: AuthCurrentUser) {
      await this.access.assertSessionPermission(
         input.sessionId,
         user,
         'klass.correction.read',
      );

      const skip = input.skip ?? 0;
      const take = input.take ?? 20;
      const where = {
         sessionId: input.sessionId,
      };

      const [count, rows] = await Promise.all([
         this.prisma.correctionCapture.count({ where }),
         this.prisma.correctionCapture.findMany({
            where,
            skip,
            take,
            orderBy: [{ createdAt: 'desc' }],
            include: {
               Student: {
                  include: {
                     User: {
                        include: {
                           Profile: true,
                        },
                     },
                  },
               },
               CorrectionExam: true,
            },
         }),
      ]);

      return { count, rows };
   }
}
