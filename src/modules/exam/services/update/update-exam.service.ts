import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateExamInput } from '../../inputs/update-exam.input';
import { ExamRulesService } from '../shared/exam-rules.service';

@Injectable()
export class UpdateExamService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly rules: ExamRulesService,
   ) {}

   async run(input: UpdateExamInput, user: AuthCurrentUser) {
      const exam = await this.rules.assertExamPermission({
         user,
         examId: input.examId,
         permissionCode: 'klass.exam.manage',
      });

      if (!input.title && input.description === undefined && !input.answerKey) {
         throw new BadRequestException('Nenhuma alteração informada.');
      }

      if (input.answerKey) {
         this.rules.validateAnswerKey(input.answerKey);
      }

      await this.prisma.$transaction(async (tx) => {
         if (input.title || input.description !== undefined) {
            await tx.exam.update({
               where: { id: exam.id },
               data: {
                  title: input.title?.trim() || undefined,
                  description:
                     input.description !== undefined
                        ? input.description?.trim() || null
                        : undefined,
               },
            });
         }

         if (input.answerKey) {
            const questions = await tx.question.findMany({
               where: { examId: exam.id },
               orderBy: { number: 'asc' },
               select: { id: true, number: true },
            });

            if (questions.length !== input.answerKey.length) {
               throw new BadRequestException(
                  'A nova grade de respostas deve ter a mesma quantidade de questões da prova.',
               );
            }

            for (let index = 0; index < questions.length; index += 1) {
               const question = questions[index];
               await tx.question.update({
                  where: { id: question.id },
                  data: {
                     correct: input.answerKey[index],
                  },
               });
            }
         }
      });

      return this.prisma.exam.findUniqueOrThrow({
         where: { id: exam.id },
         include: {
            Questions: {
               orderBy: { number: 'asc' },
            },
            TemplateVersion: true,
         },
      });
   }
}
