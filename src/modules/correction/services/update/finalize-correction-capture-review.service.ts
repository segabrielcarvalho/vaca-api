import {
   BadRequestException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import {
   CorrectionCaptureQuestionGradingOverride,
   Prisma,
} from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CorrectionEventStageEnum } from '../../enums/correction-event-stage.enum';
import { CorrectionCaptureReviewOutcomeEnum } from '../../enums/correction-capture-review-outcome.enum';
import { FinalizeCorrectionCaptureReviewInput } from '../../inputs/finalize-correction-capture-review.input';
import { CorrectionPublisherService } from '../correction-publisher.service';
import { GetCorrectionCaptureReviewService } from '../get/get-correction-capture-review.service';
import { CorrectionAccessService } from '../shared/correction-access.service';
import { CorrectionCaptureArtifactCleanupService } from '../shared/correction-capture-artifact-cleanup.service';
import { CorrectionMetricsService } from '../shared/correction-metrics.service';
import { CorrectionExamActivationService } from '../shared/correction-exam-activation.service';
import type { ReplacedCorrectionCaptureArtifact } from '../shared/correction-exam-activation.service';
import { CorrectionReviewGradingService } from '../shared/correction-review-grading.service';

@Injectable()
export class FinalizeCorrectionCaptureReviewService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly access: CorrectionAccessService,
      private readonly scopedAccessService: ScopedAccessService,
      private readonly metrics: CorrectionMetricsService,
      private readonly publisher: CorrectionPublisherService,
      private readonly correctionExamActivation: CorrectionExamActivationService,
      private readonly artifactCleanup: CorrectionCaptureArtifactCleanupService,
      private readonly grading: CorrectionReviewGradingService,
      private readonly getReview: GetCorrectionCaptureReviewService,
   ) {}

   async run(
      input: FinalizeCorrectionCaptureReviewInput,
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

      const capture = await this.prisma.correctionCapture.findUnique({
         where: { id: captureRef.id },
         include: {
            Exam: {
               include: {
                  Questions: {
                     orderBy: { number: 'asc' },
                  },
               },
            },
            CorrectionExam: {
               include: {
                  Items: true,
               },
            },
            ReviewOverrides: true,
         },
      });

      if (!capture) {
         throw new NotFoundException('Capture não encontrado.');
      }

      const nextStudentId = student?.id ?? capture.studentId ?? null;
      const nextRegistrationNumber =
         student?.registrationNumber ?? capture.registrationNumber ?? null;

      if (
         input.outcome === CorrectionCaptureReviewOutcomeEnum.graded &&
         !nextStudentId
      ) {
         throw new BadRequestException(
            'Selecione um aluno antes de finalizar a revisão.',
         );
      }

      if (
         input.outcome === CorrectionCaptureReviewOutcomeEnum.invalidated &&
         !input.reviewNotes?.trim()
      ) {
         throw new BadRequestException(
            'Informe o motivo para invalidar a captura.',
         );
      }

      const overrideSource =
         input.questionOverrides !== undefined
            ? normalizedOverrides
            : capture.ReviewOverrides.map((override) => ({
                 questionId: override.questionId,
                 selectedAlternatives: override.selectedAlternatives,
                 gradingOverride: override.gradingOverride,
                 reason: override.reason,
                 note: override.note,
              }));

      const questionStates = this.grading.buildQuestionStates({
         questions: capture.Exam.Questions,
         omrPayload: capture.omrPayload as Prisma.JsonValue | null | undefined,
         overrides: overrideSource,
         existingItems: capture.CorrectionExam?.Items.map((item) => ({
            questionId: item.questionId,
            selected: item.selected,
         })),
      });
      const gradedResult = this.grading.computeGradedResult(questionStates);
      const replacedSessionIds = new Set<string>();
      const replacedCaptureArtifacts: ReplacedCorrectionCaptureArtifact[] = [];

      await this.prisma.$transaction(
         async (tx) => {
            if (input.questionOverrides !== undefined) {
               const questionIds = normalizedOverrides.map(
                  (item) => item.questionId,
               );

               await tx.correctionCaptureReviewOverride.deleteMany({
                  where: {
                     captureId: capture.id,
                     ...(questionIds.length > 0
                        ? { questionId: { notIn: questionIds } }
                        : {}),
                  },
               });

               for (const override of normalizedOverrides) {
                  await tx.correctionCaptureReviewOverride.upsert({
                     where: {
                        captureId_questionId: {
                           captureId: capture.id,
                           questionId: override.questionId,
                        },
                     },
                     create: {
                        captureId: capture.id,
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

            if (
               input.outcome === CorrectionCaptureReviewOutcomeEnum.invalidated
            ) {
               if (capture.correctionExamId) {
                  await this.correctionExamActivation.deleteCorrectionResult(
                     tx,
                     capture.correctionExamId,
                  );
               }

               await tx.correctionCapture.update({
                  where: { id: capture.id },
                  data: {
                     status: 'invalidated',
                     reviewReasons:
                        input.reviewReasons ?? capture.reviewReasons,
                     reviewNotes: input.reviewNotes?.trim() || null,
                     studentId: nextStudentId,
                     registrationNumber: nextRegistrationNumber,
                     correctionExamId: null,
                     resolvedByAgentId: reviewedByAgentId,
                     resolvedAt: new Date(),
                  },
               });
            } else if (
               input.outcome === CorrectionCaptureReviewOutcomeEnum.needs_review
            ) {
               await tx.correctionCapture.update({
                  where: { id: capture.id },
                  data: {
                     status: 'needs_review',
                     reviewReasons:
                        input.reviewReasons ?? capture.reviewReasons,
                     reviewNotes: input.reviewNotes?.trim() || null,
                     studentId: nextStudentId,
                     registrationNumber: nextRegistrationNumber,
                     resolvedByAgentId: null,
                     resolvedAt: null,
                  },
               });
            } else {
               let correctionExamId = capture.correctionExamId;

               if (!correctionExamId) {
                  const createdCorrection =
                     await this.correctionExamActivation.createLatestActiveCorrection(
                        tx,
                        {
                           examId: capture.examId,
                           studentId: nextStudentId!,
                           filePath:
                              capture.overlayImagePath ??
                              capture.originalImagePath,
                           score: gradedResult.score,
                           status: 'graded',
                           gradedByAgentId: reviewedByAgentId,
                           metadata: {
                              source: 'manual_review',
                              captureId: capture.id,
                              effectiveQuestionCount:
                                 gradedResult.effectiveQuestionCount,
                              effectiveMaxScore: gradedResult.effectiveMaxScore,
                              overrideCount: overrideSource.length,
                           } satisfies Prisma.InputJsonValue,
                        },
                     );

                  correctionExamId = createdCorrection.correction.id;
                  createdCorrection.replacedSessionIds.forEach((sessionId) =>
                     replacedSessionIds.add(sessionId),
                  );
                  replacedCaptureArtifacts.push(
                     ...createdCorrection.replacedCaptureArtifacts,
                  );
               } else {
                  const updatedCorrection =
                     await this.correctionExamActivation.updateLatestActiveCorrection(
                        tx,
                        {
                           correctionExamId,
                           examId: capture.examId,
                           studentId: nextStudentId!,
                           filePath:
                              capture.overlayImagePath ??
                              capture.originalImagePath,
                           score: gradedResult.score,
                           status: 'graded',
                           gradedByAgentId: reviewedByAgentId,
                           metadata: {
                              source: 'manual_review',
                              captureId: capture.id,
                              effectiveQuestionCount:
                                 gradedResult.effectiveQuestionCount,
                              effectiveMaxScore: gradedResult.effectiveMaxScore,
                              overrideCount: overrideSource.length,
                           } satisfies Prisma.InputJsonValue,
                        },
                     );

                  updatedCorrection.replacedSessionIds.forEach((sessionId) =>
                     replacedSessionIds.add(sessionId),
                  );
                  replacedCaptureArtifacts.push(
                     ...updatedCorrection.replacedCaptureArtifacts,
                  );

                  await tx.correctionQuestion.deleteMany({
                     where: { correctionId: correctionExamId },
                  });
               }

               await tx.correctionQuestion.createMany({
                  data: gradedResult.correctionItems.map((item) => ({
                     correctionId: correctionExamId!,
                     questionId: item.questionId,
                     selected: item.selected,
                     isCorrect: item.isCorrect,
                  })),
               });

               await tx.correctionCapture.update({
                  where: { id: capture.id },
                  data: {
                     status: 'graded',
                     reviewReasons: input.reviewReasons ?? [],
                     reviewNotes: input.reviewNotes?.trim() || null,
                     studentId: nextStudentId,
                     registrationNumber: nextRegistrationNumber,
                     correctionExamId,
                     resolvedByAgentId: reviewedByAgentId,
                     resolvedAt: new Date(),
                     errorMessage: null,
                  },
               });
            }

            await tx.correctionCaptureReviewAuditLog.create({
               data: {
                  captureId: capture.id,
                  actorAgentId: reviewedByAgentId,
                  action:
                     input.outcome === CorrectionCaptureReviewOutcomeEnum.graded
                        ? 'review_finalized'
                        : input.outcome ===
                            CorrectionCaptureReviewOutcomeEnum.invalidated
                          ? 'capture_invalidated'
                          : 'returned_to_review',
                  payload: {
                     outcome: input.outcome,
                     studentId: nextStudentId,
                     reviewReasons:
                        input.reviewReasons ?? capture.reviewReasons,
                     hasReviewNotes: Boolean(input.reviewNotes?.trim()),
                     overrideCount: overrideSource.length,
                     score:
                        input.outcome ===
                        CorrectionCaptureReviewOutcomeEnum.graded
                           ? gradedResult.score
                           : null,
                  } satisfies Prisma.InputJsonValue,
               },
            });
         },
         {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
         },
      );

      await this.artifactCleanup.cleanupReplacedCaptureArtifacts({
         replacedCaptureArtifacts,
         preservedPaths: [
            capture.overlayImagePath ?? capture.originalImagePath,
            capture.rectifiedImagePath,
         ],
         source: 'finalize_correction_capture_review',
      });

      if (input.outcome !== CorrectionCaptureReviewOutcomeEnum.needs_review) {
         await this.publisher.publish({
            sessionId: capture.sessionId,
            captureId: capture.id,
            stage: CorrectionEventStageEnum.CAPTURE_RESOLVED,
            payload: {
               captureId: capture.id,
               status: input.outcome,
            },
         });
      }

      const affectedSessionIds = Array.from(
         new Set([capture.sessionId, ...replacedSessionIds]),
      );
      await Promise.all(
         affectedSessionIds.map((sessionId) =>
            this.metrics.refreshSessionMetrics(sessionId),
         ),
      );
      return this.getReview.runById(capture.id);
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
      overrides: FinalizeCorrectionCaptureReviewInput['questionOverrides'],
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
