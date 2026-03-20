import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListKlassExamsInput } from '../../inputs/list-klass-exams.input';
import { ExamRulesService } from '../shared/exam-rules.service';

@Injectable()
export class ListKlassExamsService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly rules: ExamRulesService,
   ) {}

   async run(input: ListKlassExamsInput, user: AuthCurrentUser) {
      await this.rules.assertKlassPermission({
         user,
         klassId: input.klassId,
         permissionCode: 'klass.exam.read',
      });

      const skip = input.skip ?? 0;
      const take = input.take ?? 20;
      const search = input.search?.trim();
      const where = {
         klassId: input.klassId,
         isActive: input.isActive ?? true,
         OR:
            search && search.length > 0
               ? [
                    {
                       title: {
                          contains: search,
                          mode: 'insensitive' as const,
                       },
                    },
                    {
                       description: {
                          contains: search,
                          mode: 'insensitive' as const,
                       },
                    },
                 ]
               : undefined,
      };

      const [count, rows] = await Promise.all([
         this.prisma.exam.count({ where }),
         this.prisma.exam.findMany({
            where,
            skip,
            take,
            orderBy: [{ updatedAt: 'desc' }],
            include: {
               _count: {
                  select: {
                     Questions: true,
                     Corrections: true,
                     CorrectionSessions: true,
                     Captures: true,
                  },
               },
               TemplateVersion: {
                  include: {
                     Template: true,
                  },
               },
            },
         }),
      ]);

      return { count, rows };
   }
}
