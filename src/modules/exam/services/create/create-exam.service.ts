import {
   BadRequestException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateExamInput } from '../../inputs/create-exam.input';
import { ExamRulesService } from '../shared/exam-rules.service';

@Injectable()
export class CreateExamService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly rules: ExamRulesService,
   ) {}

   async run(input: CreateExamInput, user: AuthCurrentUser) {
      this.rules.validateAnswerKey(input.answerKey);

      await this.rules.assertKlassPermission({
         user,
         klassId: input.klassId,
         permissionCode: 'klass.exam.manage',
      });

      const [klass, templateVersion] = await Promise.all([
         this.prisma.klass.findUnique({
            where: { id: input.klassId },
            select: { id: true, courseId: true },
         }),
         this.prisma.omrTemplateVersion.findUnique({
            where: { id: input.templateVersionId },
            select: {
               id: true,
               status: true,
               layoutJson: true,
               compiledGeometryJson: true,
               Template: {
                  select: {
                     courseId: true,
                  },
               },
            },
         }),
      ]);

      if (!klass) {
         throw new NotFoundException('Turma não encontrada.');
      }

      if (!templateVersion) {
         throw new NotFoundException('Versão de template não encontrada.');
      }

      if (templateVersion.status !== 'published') {
         throw new BadRequestException(
            'A prova só pode usar uma versão de template publicada.',
         );
      }

      if (templateVersion.Template.courseId !== klass.courseId) {
         throw new BadRequestException(
            'A versão do template não pertence ao mesmo curso da turma.',
         );
      }

      this.rules.assertTemplateQuestionCountMatchesAnswerKey({
         answerKeyLength: input.answerKey.length,
         layoutJson: templateVersion.layoutJson,
         compiledGeometryJson: templateVersion.compiledGeometryJson,
      });

      const questionValue = input.questionValue ?? 1;

      const exam = await this.prisma.$transaction(async (tx) => {
         const created = await tx.exam.create({
            data: {
               klassId: input.klassId,
               title: input.title.trim(),
               description: input.description?.trim() || null,
               templateVersionId: input.templateVersionId,
            },
         });

         await tx.question.createMany({
            data: input.answerKey.map((correct, index) => ({
               examId: created.id,
               number: index + 1,
               correct,
               value: questionValue,
            })),
         });

         return created;
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
