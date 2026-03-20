import { Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetExamInput } from '../../inputs/get-exam.input';
import { ExamRulesService } from '../shared/exam-rules.service';

@Injectable()
export class GetExamService {
   constructor(
      private readonly rules: ExamRulesService,
      private readonly prisma: PrismaService,
   ) {}

   async run(input: GetExamInput, user: AuthCurrentUser) {
      const exam = await this.rules.assertExamPermission({
         user,
         examId: input.examId,
         permissionCode: 'klass.exam.read',
      });

      return this.prisma.exam.findUniqueOrThrow({
         where: { id: exam.id },
         include: {
            Klass: {
               include: {
                  Course: true,
               },
            },
            Questions: {
               orderBy: { number: 'asc' },
            },
            TemplateVersion: {
               include: {
                  Template: true,
               },
            },
         },
      });
   }
}
