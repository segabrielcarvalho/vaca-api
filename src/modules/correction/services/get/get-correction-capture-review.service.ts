import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { GetUrlService } from '../../../storage/services/get-url.service';
import { CorrectionCaptureQuestionGradingOverride } from '../../../graphql/@generated/prisma/correction-capture-question-grading-override.enum';
import { CorrectionCaptureReviewObject } from '../../objects/correction-capture-review.object';
import { CorrectionAccessService } from '../shared/correction-access.service';
import {
   CorrectionReviewGradingService,
   type CorrectionReviewQuestionState,
} from '../shared/correction-review-grading.service';

@Injectable()
export class GetCorrectionCaptureReviewService {
   constructor(
      private readonly access: CorrectionAccessService,
      private readonly prisma: PrismaService,
      private readonly getUrlService: GetUrlService,
      private readonly grading: CorrectionReviewGradingService,
   ) {}

   async run(captureId: string, user: AuthCurrentUser) {
      await this.access.assertCapturePermission(
         captureId,
         user,
         'klass.correction.review',
      );

      return this.runById(captureId);
   }

   async runById(captureId: string): Promise<CorrectionCaptureReviewObject> {
      const capture = await this.prisma.correctionCapture.findUnique({
         where: { id: captureId },
         include: {
            Exam: {
               include: {
                  Questions: {
                     orderBy: { number: 'asc' },
                  },
                  Klass: true,
               },
            },
            Student: {
               include: {
                  User: {
                     include: {
                        Profile: true,
                     },
                  },
               },
            },
            CorrectionExam: {
               include: {
                  Items: true,
               },
            },
            ReviewOverrides: {
               orderBy: { createdAt: 'asc' },
            },
            ReviewAuditLogs: {
               orderBy: { createdAt: 'desc' },
               take: 20,
               include: {
                  Actor: {
                     include: {
                        User: {
                           include: {
                              Profile: true,
                           },
                        },
                     },
                  },
               },
            },
         },
      });

      if (!capture) {
         throw new NotFoundException('Capture não encontrado.');
      }

      const questions = this.grading.buildQuestionStates({
         questions: capture.Exam.Questions,
         omrPayload: capture.omrPayload as Prisma.JsonValue | null | undefined,
         overrides: capture.ReviewOverrides.map((override) => ({
            questionId: override.questionId,
            selectedAlternatives: override.selectedAlternatives,
            gradingOverride: override.gradingOverride,
            reason: override.reason,
            note: override.note,
         })),
         existingItems: capture.CorrectionExam?.Items.map((item) => ({
            questionId: item.questionId,
            selected: item.selected,
         })),
      });

      return {
         captureId: capture.id,
         sessionId: capture.sessionId,
         examId: capture.examId,
         klassId: capture.Exam.klassId,
         examTitle: capture.Exam.title,
         questionCount: capture.Exam.Questions.length,
         status: capture.status,
         reviewReasons: capture.reviewReasons,
         reviewNotes: capture.reviewNotes,
         errorMessage: capture.errorMessage,
         registrationNumber: capture.registrationNumber,
         previewImageUrl: await this.toSignedUrl(
            capture.overlayImagePath ?? capture.originalImagePath,
         ),
         createdAt: capture.createdAt,
         updatedAt: capture.updatedAt,
         student: capture.Student
            ? {
                 id: capture.Student.id,
                 registrationNumber: capture.Student.registrationNumber,
                 name: capture.Student.User?.Profile?.name ?? null,
                 email: capture.Student.User?.email ?? null,
              }
            : null,
         correctionExamId: capture.CorrectionExam?.id ?? null,
         score: capture.CorrectionExam?.score ?? null,
         attempt: capture.CorrectionExam?.attempt ?? null,
         questions: questions.map((question) =>
            this.mapQuestionState(question),
         ),
         auditLogs: capture.ReviewAuditLogs.map((log) => ({
            id: log.id,
            createdAt: log.createdAt,
            action: log.action,
            actorId: log.actorAgentId ?? null,
            actorName: log.Actor?.User?.Profile?.name ?? null,
         })),
      };
   }

   private mapQuestionState(question: CorrectionReviewQuestionState) {
      return {
         questionId: question.questionId,
         number: question.number,
         value: question.value,
         correctAlternative: question.correctAlternative,
         omrSelectedAlternatives: question.omrSelectedAlternatives,
         currentSelectedAlternatives: question.currentSelectedAlternatives,
         gradingOverride:
            CorrectionCaptureQuestionGradingOverride[question.gradingOverride],
         isCurrentCorrect: question.isCurrentCorrect,
         reason: question.reason ?? null,
         note: question.note ?? null,
      };
   }

   private async toSignedUrl(path: string | null | undefined) {
      if (!path || path.trim().length === 0) {
         return null;
      }

      if (/^https?:\/\//i.test(path)) {
         return path;
      }

      try {
         return await this.getUrlService.run(path, 600, true);
      } catch {
         return null;
      }
   }
}
