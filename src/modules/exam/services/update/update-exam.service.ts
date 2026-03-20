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

         const templateVersion =
            await this.prisma.omrTemplateVersion.findUnique({
               where: { id: exam.templateVersionId },
               select: {
                  id: true,
                  layoutJson: true,
                  compiledGeometryJson: true,
               },
            });

         if (!templateVersion) {
            throw new BadRequestException(
               'Versão de template da prova não encontrada.',
            );
         }

         this.rules.assertTemplateQuestionCountMatchesAnswerKey({
            answerKeyLength: input.answerKey.length,
            layoutJson: templateVersion.layoutJson,
            compiledGeometryJson: templateVersion.compiledGeometryJson,
         });
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
