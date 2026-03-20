import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ExamCount } from '../../graphql/@generated/exam/exam-count.output';
import { Exam } from '../../graphql/@generated/exam/exam.model';
import { PrismaService } from '../../prisma/prisma.service';

type ExamCountShape = {
   Questions?: number;
   Corrections?: number;
   CorrectionSessions?: number;
   Captures?: number;
};

function hasCompleteCount(
   value?: ExamCountShape | null,
): value is Required<ExamCountShape> {
   return (
      typeof value?.Questions === 'number' &&
      typeof value.Corrections === 'number' &&
      typeof value.CorrectionSessions === 'number' &&
      typeof value.Captures === 'number'
   );
}

@Resolver(() => Exam)
export class ExamFieldsResolver {
   constructor(private readonly prisma: PrismaService) {}

   @ResolveField(() => ExamCount)
   async _count(
      @Parent() exam: { id: string; _count?: ExamCountShape | null },
   ): Promise<ExamCount> {
      if (hasCompleteCount(exam._count)) {
         return exam._count;
      }

      const result = await this.prisma.exam.findUniqueOrThrow({
         where: { id: exam.id },
         select: {
            _count: {
               select: {
                  Questions: true,
                  Corrections: true,
                  CorrectionSessions: true,
                  Captures: true,
               },
            },
         },
      });

      return result._count;
   }
}
