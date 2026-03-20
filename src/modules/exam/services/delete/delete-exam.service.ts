import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { DeleteExamInput } from '../../inputs/delete-exam.input';
import { ExamRulesService } from '../shared/exam-rules.service';

@Injectable()
export class DeleteExamService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly rules: ExamRulesService,
   ) {}

   async run(input: DeleteExamInput, user: AuthCurrentUser) {
      const exam = await this.rules.assertExamPermission({
         user,
         examId: input.examId,
         permissionCode: 'klass.exam.manage',
      });

      if (!exam.isActive) {
         return exam;
      }

      return this.prisma.exam.update({
         where: { id: exam.id },
         data: { isActive: false },
      });
   }
}
