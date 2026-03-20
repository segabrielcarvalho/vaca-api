import {
   BadRequestException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import {
   AclScopeType,
   type Exam as PrismaExam,
} from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';

const QUESTION_COUNT_MIN = 10;
const QUESTION_COUNT_MAX = 60;
const QUESTION_COUNT_STEP = 5;
type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
   if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
   }

   return value as JsonObject;
}

function asInteger(value: unknown): number | null {
   const numeric = Number(value);
   if (!Number.isInteger(numeric)) {
      return null;
   }

   return numeric;
}

@Injectable()
export class ExamRulesService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {}

   validateAnswerKey(answerKey: number[]) {
      const count = answerKey.length;
      if (count < QUESTION_COUNT_MIN || count > QUESTION_COUNT_MAX) {
         throw new BadRequestException(
            `A prova deve ter entre ${QUESTION_COUNT_MIN} e ${QUESTION_COUNT_MAX} questões.`,
         );
      }

      if (count % QUESTION_COUNT_STEP !== 0) {
         throw new BadRequestException(
            `A quantidade de questões deve ser múltiplo de ${QUESTION_COUNT_STEP}.`,
         );
      }
   }

   assertTemplateQuestionCountMatchesAnswerKey(input: {
      answerKeyLength: number;
      layoutJson: unknown;
      compiledGeometryJson: unknown;
   }) {
      const layout = asObject(input.layoutJson);
      const compiledGeometry = asObject(input.compiledGeometryJson);
      const questionsBlock = asObject(layout.questionsBlock);
      const compiledQuestions = asObject(compiledGeometry.questions);
      const expectedQuestionCount =
         asInteger(questionsBlock.questionCount) ??
         asInteger(compiledQuestions.questionCount);

      if (!expectedQuestionCount) {
         throw new BadRequestException(
            'Template OMR inválido: questionCount não definido no layout.',
         );
      }

      if (input.answerKeyLength !== expectedQuestionCount) {
         throw new BadRequestException(
            `A grade de respostas deve conter ${expectedQuestionCount} questões para o template informado.`,
         );
      }
   }

   async assertKlassPermission(input: {
      user: AuthCurrentUser;
      klassId: string;
      permissionCode: string;
   }) {
      await this.scopedAccessService.assertPermission({
         user: input.user,
         permissionCode: input.permissionCode,
         scopeType: AclScopeType.klass,
         scopeId: input.klassId,
      });
   }

   async getExamById(examId: string): Promise<PrismaExam> {
      const exam = await this.prisma.exam.findUnique({ where: { id: examId } });
      if (!exam) {
         throw new NotFoundException('Prova não encontrada.');
      }

      return exam;
   }

   async assertExamPermission(input: {
      user: AuthCurrentUser;
      examId: string;
      permissionCode: string;
   }): Promise<PrismaExam> {
      const exam = await this.getExamById(input.examId);

      await this.scopedAccessService.assertPermission({
         user: input.user,
         permissionCode: input.permissionCode,
         scopeType: AclScopeType.klass,
         scopeId: exam.klassId,
      });

      return exam;
   }
}
