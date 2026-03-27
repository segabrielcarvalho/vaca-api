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
   examId: string;
   studentId: string;
   filePath: string;
   score: number | null;
   status: 'pending' | 'graded' | 'returned';
   gradedByAgentId?: string | null;
   metadata?: Prisma.InputJsonValue;
};

export type CorrectionExamWriteResult<T> = {
   correction: T;
   replacedSessionIds: string[];
   replacedCaptureArtifacts: ReplacedCorrectionCaptureArtifact[];
};

@Injectable()
export class CorrectionExamActivationService {
   async createLatestActiveCorrection(
      tx: Prisma.TransactionClient,
      input: CorrectionExamWriteInput,
   ): Promise<CorrectionExamWriteResult<Prisma.CorrectionExamGetPayload<{}>>> {
      const nextAttempt = await this.getNextAttempt(tx, input);
      const { replacedSessionIds, replacedCaptureArtifacts } =
         await this.deleteOtherCorrections(tx, {
            examId: input.examId,
            studentId: input.studentId,
         });

      const correction = await tx.correctionExam.create({
         data: {
            examId: input.examId,
            studentId: input.studentId,
            filePath: input.filePath,
            attempt: nextAttempt,
            score: input.score,
            status: input.status,
            gradedByAgentId: input.gradedByAgentId,
            metadata: input.metadata,
            isActive: true,
         },
      });

      return {
         correction,
         replacedSessionIds,
         replacedCaptureArtifacts,
      };
   }

   async updateLatestActiveCorrection(
      tx: Prisma.TransactionClient,
      input: CorrectionExamWriteInput & {
         correctionExamId: string;
      },
   ): Promise<CorrectionExamWriteResult<Prisma.CorrectionExamGetPayload<{}>>> {
      const { replacedSessionIds, replacedCaptureArtifacts } =
         await this.deleteOtherCorrections(tx, {
            examId: input.examId,
            studentId: input.studentId,
            excludeCorrectionExamId: input.correctionExamId,
         });

      const correction = await tx.correctionExam.update({
         where: { id: input.correctionExamId },
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
         replacedSessionIds,
         replacedCaptureArtifacts,
      };
   }

   async deleteCorrectionResult(
      tx: Prisma.TransactionClient,
      correctionExamId: string,
   ) {
      return tx.correctionExam.delete({
         where: { id: correctionExamId },
      });
   }

   private async getNextAttempt(
      tx: Prisma.TransactionClient,
      input: Pick<CorrectionExamWriteInput, 'examId' | 'studentId'>,
   ) {
      const result = await tx.correctionExam.aggregate({
         where: {
            examId: input.examId,
            studentId: input.studentId,
         },
         _max: {
            attempt: true,
         },
      });

      return (result._max.attempt ?? 0) + 1;
   }

   private async deleteOtherCorrections(
      tx: Prisma.TransactionClient,
      input: {
         examId: string;
         studentId: string;
         excludeCorrectionExamId?: string;
      },
   ): Promise<{
      replacedSessionIds: string[];
      replacedCaptureArtifacts: ReplacedCorrectionCaptureArtifact[];
   }> {
      const existingCorrections = await tx.correctionExam.findMany({
         where: {
            examId: input.examId,
            studentId: input.studentId,
            ...(input.excludeCorrectionExamId
               ? {
                    id: {
                       not: input.excludeCorrectionExamId,
                    },
                 }
               : {}),
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

      if (existingCorrections.length === 0) {
         return {
            replacedSessionIds: [],
            replacedCaptureArtifacts: [],
         };
      }

      const correctionIds = existingCorrections.map((item) => item.id);
      const replacedCaptureArtifacts = existingCorrections
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
      const captures = replacedCaptureArtifacts.map((capture) => ({
         id: capture.captureId,
         sessionId: capture.sessionId,
      }));
      const captureIds = captures.map((capture) => capture.id);

      if (captureIds.length > 0) {
         await tx.correctionSessionEvent.deleteMany({
            where: {
               captureId: {
                  in: captureIds,
               },
            },
         });

         await tx.correctionCapture.deleteMany({
            where: {
               id: {
                  in: captureIds,
               },
            },
         });
      }

      await tx.correctionExam.deleteMany({
         where: {
            id: {
               in: correctionIds,
            },
         },
      });

      return {
         replacedSessionIds: Array.from(
            new Set(captures.map((capture) => capture.sessionId)),
         ),
         replacedCaptureArtifacts,
      };
   }
}
