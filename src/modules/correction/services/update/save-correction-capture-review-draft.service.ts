import { Injectable, NotFoundException } from '@nestjs/common';
import {
   CorrectionCaptureQuestionGradingOverride,
   Prisma,
} from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SaveCorrectionCaptureReviewDraftInput } from '../../inputs/save-correction-capture-review-draft.input';
import { GetCorrectionCaptureReviewService } from '../get/get-correction-capture-review.service';
import { CorrectionAccessService } from '../shared/correction-access.service';
import { CorrectionExamActivationService } from '../shared/correction-exam-activation.service';

@Injectable()
export class SaveCorrectionCaptureReviewDraftService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly access: CorrectionAccessService,
      private readonly scopedAccessService: ScopedAccessService,
      private readonly correctionExamActivation: CorrectionExamActivationService,
      private readonly getReview: GetCorrectionCaptureReviewService,
   ) {}

   async run(
      input: SaveCorrectionCaptureReviewDraftInput,
      user: AuthCurrentUser,
   ) {
      const captureRef = await this.access.assertCapturePermission(
         input.captureId,
         user,
         'klass.correction.review',
      );
      const reviewedByAgentId =
         await this.scopedAccessService.getAgentIdByUserId(user.id);
      const student = await this.resolveStudent(
         input.studentId,
         captureRef.Exam.klassId,
      );
      const normalizedOverrides = this.normalizeQuestionOverrides(
         input.questionOverrides,
      );

      await this.prisma.$transaction(async (tx) => {
         if (student?.id) {
            await this.correctionExamActivation.invalidateOtherPendingReviewCaptures(
               tx,
               {
                  examId: captureRef.examId,
                  studentId: student.id,
                  preserveCaptureId: captureRef.id,
               },
            );
         }

         await tx.correctionCapture.update({
            where: { id: captureRef.id },
            data: {
               status: 'needs_review',
               reviewReasons: input.reviewReasons ?? undefined,
               reviewNotes: input.reviewNotes?.trim() || null,
               studentId: student?.id ?? undefined,
               registrationNumber:
                  student?.registrationNumber ??
                  (input.studentId ? null : undefined),
               resolvedByAgentId: null,
               resolvedAt: null,
            },
         });

         if (input.questionOverrides) {
            const questionIds = normalizedOverrides.map(
               (item) => item.questionId,
            );

            await tx.correctionCaptureReviewOverride.deleteMany({
               where: {
                  captureId: captureRef.id,
                  ...(questionIds.length > 0
                     ? { questionId: { notIn: questionIds } }
                     : {}),
               },
            });

            for (const override of normalizedOverrides) {
               await tx.correctionCaptureReviewOverride.upsert({
                  where: {
                     captureId_questionId: {
                        captureId: captureRef.id,
                        questionId: override.questionId,
                     },
                  },
                  create: {
                     captureId: captureRef.id,
                     questionId: override.questionId,
                     selectedAlternatives: override.selectedAlternatives,
                     gradingOverride: override.gradingOverride,
                     reason: override.reason,
                     note: override.note,
                     reviewedByAgentId,
                     reviewedAt: new Date(),
                  },
                  update: {
                     selectedAlternatives: override.selectedAlternatives,
                     gradingOverride: override.gradingOverride,
                     reason: override.reason,
                     note: override.note,
                     reviewedByAgentId,
                     reviewedAt: new Date(),
                  },
               });
            }
         }

         await tx.correctionCaptureReviewAuditLog.create({
            data: {
               captureId: captureRef.id,
               actorAgentId: reviewedByAgentId,
               action: 'draft_saved',
               payload: {
                  studentId: student?.id ?? null,
                  reviewReasons: input.reviewReasons ?? [],
                  hasReviewNotes: Boolean(input.reviewNotes?.trim()),
                  overrideCount: normalizedOverrides.length,
               } satisfies Prisma.InputJsonValue,
            },
         });
      });

      return this.getReview.runById(captureRef.id);
   }

   private async resolveStudent(
      studentId: string | undefined,
      klassId: string,
   ) {
      if (!studentId) {
         return null;
      }

      const student = await this.prisma.student.findFirst({
         where: {
            id: studentId,
            Enrollments: {
               some: {
                  klassId,
               },
            },
         },
         select: {
            id: true,
            registrationNumber: true,
         },
      });

      if (!student) {
         throw new NotFoundException(
            'Aluno não encontrado para a turma desta captura.',
         );
      }

      return student;
   }

   private normalizeQuestionOverrides(
      overrides: SaveCorrectionCaptureReviewDraftInput['questionOverrides'],
   ) {
      return (overrides ?? [])
         .map((item) => {
            const selectedAlternatives = Array.from(
               new Set(
                  (item.selectedAlternatives ?? []).filter(
                     (value): value is number =>
                        Number.isInteger(value) && value >= 1 && value <= 5,
                  ),
               ),
            ).sort((a, b) => a - b);
            const gradingOverride =
               (item.gradingOverride as CorrectionCaptureQuestionGradingOverride) ??
               CorrectionCaptureQuestionGradingOverride.auto;
            const reason = item.reason?.trim() || null;
            const note = item.note?.trim() || null;
            const shouldPersist =
               item.selectedAlternatives !== undefined ||
               gradingOverride !==
                  CorrectionCaptureQuestionGradingOverride.auto ||
               Boolean(reason) ||
               Boolean(note);

            if (!shouldPersist) {
               return null;
            }

            return {
               questionId: item.questionId,
               selectedAlternatives,
               gradingOverride,
               reason,
               note,
            };
         })
         .filter(
            (
               item,
            ): item is {
               questionId: string;
               selectedAlternatives: number[];
               gradingOverride: CorrectionCaptureQuestionGradingOverride;
               reason: string | null;
               note: string | null;
            } => Boolean(item),
         );
   }
}
