import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
   OmrTemplateVersionStatus,
   RoleEnum,
} from '../../../../../../.prisma/client';
import { CreateExamService } from '../../create/create-exam.service';

describe('CreateExamService', () => {
   let tx: {
      exam: {
         create: jest.Mock;
      };
      question: {
         createMany: jest.Mock;
      };
   };
   let prisma: {
      klass: {
         findUnique: jest.Mock;
      };
      omrTemplateVersion: {
         findUnique: jest.Mock;
      };
      exam: {
         findUniqueOrThrow: jest.Mock;
      };
      $transaction: jest.Mock;
   };
   let rules: {
      validateAnswerKey: jest.Mock;
      assertKlassPermission: jest.Mock;
      assertTemplateQuestionCountMatchesAnswerKey: jest.Mock;
   };
   let service: CreateExamService;

   beforeEach(() => {
      tx = {
         exam: {
            create: jest.fn(),
         },
         question: {
            createMany: jest.fn(),
         },
      };
      prisma = {
         klass: {
            findUnique: jest.fn(),
         },
         omrTemplateVersion: {
            findUnique: jest.fn(),
         },
         exam: {
            findUniqueOrThrow: jest.fn(),
         },
         $transaction: jest.fn((callback) => callback(tx)),
      };
      rules = {
         validateAnswerKey: jest.fn(),
         assertKlassPermission: jest.fn(),
         assertTemplateQuestionCountMatchesAnswerKey: jest.fn(),
      };

      service = new CreateExamService(prisma as any, rules as any);
   });

   it('deve criar prova e persistir a quantidade correta de questoes', async () => {
      const answerKey = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5];
      prisma.klass.findUnique.mockResolvedValue({
         id: 'klass-1',
         courseId: 'course-1',
      });
      prisma.omrTemplateVersion.findUnique.mockResolvedValue({
         id: 'template-version-1',
         status: OmrTemplateVersionStatus.published,
         layoutJson: { questionsBlock: { questionCount: 10 } },
         compiledGeometryJson: { questions: { questionCount: 10 } },
         Template: {
            courseId: 'course-1',
         },
      });
      tx.exam.create.mockResolvedValue({
         id: 'exam-1',
      });
      tx.question.createMany.mockResolvedValue({
         count: answerKey.length,
      });
      prisma.exam.findUniqueOrThrow.mockResolvedValue({
         id: 'exam-1',
         Questions: answerKey.map((correct, index) => ({
            id: `question-${index + 1}`,
            number: index + 1,
            correct,
            value: 2,
         })),
      });

      const result = await service.run(
         {
            klassId: 'klass-1',
            title: '  VA 2  ',
            description: '  Prova bimestral  ',
            templateVersionId: 'template-version-1',
            answerKey,
            questionValue: 2,
         },
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(rules.validateAnswerKey).toHaveBeenCalledWith(answerKey);
      expect(rules.assertKlassPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         klassId: 'klass-1',
         permissionCode: 'klass.exam.manage',
      });
      expect(
         rules.assertTemplateQuestionCountMatchesAnswerKey,
      ).toHaveBeenCalledWith({
         answerKeyLength: 10,
         layoutJson: { questionsBlock: { questionCount: 10 } },
         compiledGeometryJson: { questions: { questionCount: 10 } },
      });
      expect(tx.exam.create).toHaveBeenCalledWith({
         data: {
            klassId: 'klass-1',
            title: 'VA 2',
            description: 'Prova bimestral',
            templateVersionId: 'template-version-1',
         },
      });
      expect(tx.question.createMany).toHaveBeenCalledWith({
         data: answerKey.map((correct, index) => ({
            examId: 'exam-1',
            number: index + 1,
            correct,
            value: 2,
         })),
      });
      expect(prisma.exam.findUniqueOrThrow).toHaveBeenCalledWith({
         where: { id: 'exam-1' },
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
      expect(result).toEqual({
         id: 'exam-1',
         Questions: answerKey.map((correct, index) => ({
            id: `question-${index + 1}`,
            number: index + 1,
            correct,
            value: 2,
         })),
      });
   });

   it('deve falhar quando a quantidade do gabarito nao bater com o template', async () => {
      const mismatchError = new BadRequestException(
         'A grade de respostas deve conter 10 questões para o template informado.',
      );

      prisma.klass.findUnique.mockResolvedValue({
         id: 'klass-1',
         courseId: 'course-1',
      });
      prisma.omrTemplateVersion.findUnique.mockResolvedValue({
         id: 'template-version-1',
         status: OmrTemplateVersionStatus.published,
         layoutJson: { questionsBlock: { questionCount: 10 } },
         compiledGeometryJson: { questions: { questionCount: 10 } },
         Template: {
            courseId: 'course-1',
         },
      });
      rules.assertTemplateQuestionCountMatchesAnswerKey.mockImplementation(
         () => {
            throw mismatchError;
         },
      );

      await expect(
         service.run(
            {
               klassId: 'klass-1',
               title: 'VA 2',
               templateVersionId: 'template-version-1',
               answerKey: [1, 2, 3, 4, 5],
            } as any,
            { id: 'user-1', role: RoleEnum.user } as any,
         ),
      ).rejects.toThrow(mismatchError);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.exam.findUniqueOrThrow).not.toHaveBeenCalled();
   });

   it('deve falhar quando a turma nao existir', async () => {
      prisma.klass.findUnique.mockResolvedValue(null);
      prisma.omrTemplateVersion.findUnique.mockResolvedValue({
         id: 'template-version-1',
         status: OmrTemplateVersionStatus.published,
         layoutJson: { questionsBlock: { questionCount: 10 } },
         compiledGeometryJson: { questions: { questionCount: 10 } },
         Template: {
            courseId: 'course-1',
         },
      });

      await expect(
         service.run(
            {
               klassId: 'klass-1',
               title: 'VA 2',
               templateVersionId: 'template-version-1',
               answerKey: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
            },
            { id: 'user-1', role: RoleEnum.user } as any,
         ),
      ).rejects.toThrow(NotFoundException);
   });
});
