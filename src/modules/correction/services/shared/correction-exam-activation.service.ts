import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../.prisma/client';

export type ReplacedCorrectionCaptureArtifact = {
   correctionExamId: string;
   captureId: string;
   sessionId: string;
   originalImagePath: string | null;
   rectifiedImagePath: string | null;
   overlayImagePath: string | null;
};

type CorrectionExamWriteInput = {
   correctionExamId?: string;
   examId: string;
   studentId: string;
   filePath: string;
   score: number | null;
   status: 'pending' | 'graded' | 'returned';
   gradedByAgentId?: string | null;
   metadata?: Prisma.InputJsonValue;
   preserveCaptureId?: string;
};

export type CorrectionExamWriteResult<T> = {
   correction: T;
   replacedSessionIds: string[];
   replacedCaptureArtifacts: ReplacedCorrectionCaptureArtifact[];
};

@Injectable()
export class CorrectionExamActivationService {
   async upsertOfficialCorrection(
      tx: Prisma.TransactionClient,
      input: CorrectionExamWriteInput,
   ): Promise<
      CorrectionExamWriteResult<
         Prisma.CorrectionExamGetPayload<Prisma.CorrectionExamDefaultArgs>
      >
   > {
      const replacedSessionIds = new Set<string>();
      const replacedCaptureArtifacts: ReplacedCorrectionCaptureArtifact[] = [];

      const currentCorrection = input.correctionExamId
         ? await tx.correctionExam.findUnique({
              where: { id: input.correctionExamId },
              select: {
                 id: true,
                 examId: true,
                 studentId: true,
                 Capture: {
                    select: {
                       id: true,
                       sessionId: true,
                       originalImagePath: true,
                       rectifiedImagePath: true,
                       overlayImagePath: true,
                    },
                 },
              },
           })
         : null;

      if (currentCorrection && currentCorrection.examId === input.examId) {
         const conflictingCorrections = await this.deleteConflictingCorrections(
            tx,
            {
               examId: input.examId,
               studentId: input.studentId,
               excludeCorrectionExamId: currentCorrection.id,
            },
         );
         conflictingCorrections.replacedSessionIds.forEach((sessionId) =>
            replacedSessionIds.add(sessionId),
         );
         replacedCaptureArtifacts.push(
            ...conflictingCorrections.replacedCaptureArtifacts,
         );

         const detachedCapture = await this.detachPreviousOfficialCapture(tx, {
            correctionExamId: currentCorrection.id,
            capture: currentCorrection.Capture ?? null,
            preserveCaptureId: input.preserveCaptureId,
         });
         if (detachedCapture) {
            replacedSessionIds.add(detachedCapture.sessionId);
            replacedCaptureArtifacts.push(detachedCapture);
         }

         const correction = await tx.correctionExam.update({
            where: { id: currentCorrection.id },
            data: {
               studentId: input.studentId,
               filePath: input.filePath,
               score: input.score,
               status: input.status,
               gradedByAgentId: input.gradedByAgentId,
               metadata: input.metadata,
               isActive: true,
            },
         });

         return {
            correction,
            replacedSessionIds: [...replacedSessionIds],
            replacedCaptureArtifacts,
         };
      }

      const existingCorrection = await tx.correctionExam.findFirst({
         where: {
            examId: input.examId,
            studentId: input.studentId,
         },
         select: {
            id: true,
            Capture: {
               select: {
                  id: true,
                  sessionId: true,
                  originalImagePath: true,
                  rectifiedImagePath: true,
                  overlayImagePath: true,
               },
            },
         },
      });

      const detachedCapture = await this.detachPreviousOfficialCapture(tx, {
         correctionExamId: existingCorrection?.id ?? null,
         capture: existingCorrection?.Capture ?? null,
         preserveCaptureId: input.preserveCaptureId,
      });
      if (detachedCapture) {
         replacedSessionIds.add(detachedCapture.sessionId);
         replacedCaptureArtifacts.push(detachedCapture);
      }

      const correction = existingCorrection
         ? await tx.correctionExam.update({
              where: { id: existingCorrection.id },
              data: {
                 filePath: input.filePath,
                 score: input.score,
                 status: input.status,
                 gradedByAgentId: input.gradedByAgentId,
                 metadata: input.metadata,
                 isActive: true,
              },
           })
         : await tx.correctionExam.create({
              data: {
                 examId: input.examId,
                 studentId: input.studentId,
                 filePath: input.filePath,
                 score: input.score,
                 status: input.status,
                 gradedByAgentId: input.gradedByAgentId,
                 metadata: input.metadata,
                 isActive: true,
              },
           });

      return {
         correction,
         replacedSessionIds: [...replacedSessionIds],
         replacedCaptureArtifacts,
      };
   }

   async invalidateOtherPendingReviewCaptures(
      tx: Prisma.TransactionClient,
      input: {
         examId: string;
         studentId: string;
         preserveCaptureId: string;
      },
   ) {
      await tx.correctionCapture.updateMany({
         where: {
            examId: input.examId,
            studentId: input.studentId,
            status: 'needs_review',
            id: {
               not: input.preserveCaptureId,
            },
         },
         data: {
            status: 'invalidated',
            correctionExamId: null,
            resolvedAt: new Date(),
            errorMessage: 'Captura substituída por uma revisão mais recente.',
         },
      });
   }

   async deleteCorrectionResult(
      tx: Prisma.TransactionClient,
      correctionExamId: string,
   ) {
      return tx.correctionExam.delete({
         where: { id: correctionExamId },
      });
   }

   private async deleteConflictingCorrections(
      tx: Prisma.TransactionClient,
      input: {
         examId: string;
         studentId: string;
         excludeCorrectionExamId: string;
      },
   ): Promise<{
      replacedSessionIds: string[];
      replacedCaptureArtifacts: ReplacedCorrectionCaptureArtifact[];
   }> {
      const conflictingCorrections = await tx.correctionExam.findMany({
         where: {
            examId: input.examId,
            studentId: input.studentId,
            id: {
               not: input.excludeCorrectionExamId,
            },
         },
         select: {
            id: true,
            Capture: {
               select: {
                  id: true,
                  sessionId: true,
                  originalImagePath: true,
                  rectifiedImagePath: true,
                  overlayImagePath: true,
               },
            },
         },
      });

      if (conflictingCorrections.length === 0) {
         return {
            replacedSessionIds: [],
            replacedCaptureArtifacts: [],
         };
      }

      const correctionIds = conflictingCorrections.map((item) => item.id);
      const replacedCaptureArtifacts = conflictingCorrections
         .map((item) =>
            item.Capture
               ? {
                    correctionExamId: item.id,
                    captureId: item.Capture.id,
                    sessionId: item.Capture.sessionId,
                    originalImagePath: item.Capture.originalImagePath,
                    rectifiedImagePath: item.Capture.rectifiedImagePath,
                    overlayImagePath: item.Capture.overlayImagePath,
                 }
               : null,
         )
         .filter(
            (
               captureArtifact,
            ): captureArtifact is ReplacedCorrectionCaptureArtifact =>
               Boolean(captureArtifact),
         );

      await Promise.all(
         replacedCaptureArtifacts.map((capture) =>
            tx.correctionCapture.update({
               where: { id: capture.captureId },
               data: {
                  correctionExamId: null,
                  status: 'invalidated',
                  resolvedAt: new Date(),
                  errorMessage:
                     'Captura substituída por uma correção mais recente.',
               },
            }),
         ),
      );

      await tx.correctionExam.deleteMany({
         where: {
            id: {
               in: correctionIds,
            },
         },
      });

      return {
         replacedSessionIds: Array.from(
            new Set(
               replacedCaptureArtifacts.map((capture) => capture.sessionId),
            ),
         ),
         replacedCaptureArtifacts,
      };
   }

   private async detachPreviousOfficialCapture(
      tx: Prisma.TransactionClient,
      input: {
         correctionExamId: string | null;
         capture: {
            id: string;
            sessionId: string;
            originalImagePath: string | null;
            rectifiedImagePath: string | null;
            overlayImagePath: string | null;
         } | null;
         preserveCaptureId?: string;
      },
   ): Promise<ReplacedCorrectionCaptureArtifact | null> {
      if (
         !input.correctionExamId ||
         !input.capture ||
         input.capture.id === input.preserveCaptureId
      ) {
         return null;
      }

      await tx.correctionCapture.update({
         where: { id: input.capture.id },
         data: {
            correctionExamId: null,
            status: 'invalidated',
            resolvedAt: new Date(),
            errorMessage: 'Captura substituída por uma correção mais recente.',
         },
      });

      return {
         correctionExamId: input.correctionExamId,
         captureId: input.capture.id,
         sessionId: input.capture.sessionId,
         originalImagePath: input.capture.originalImagePath,
         rectifiedImagePath: input.capture.rectifiedImagePath,
         overlayImagePath: input.capture.overlayImagePath,
      };
   }
}
