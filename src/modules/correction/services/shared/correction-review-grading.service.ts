import {
   CorrectionCaptureQuestionGradingOverride,
   Prisma,
} from '../../../../../.prisma/client';
import { Injectable } from '@nestjs/common';

type ExamQuestionLike = {
   id: string;
   number: number;
   correct: number;
   value: number;
};

type ExistingCorrectionItemLike = {
   questionId: string;
   selected: number | null;
};

type ReviewOverrideLike = {
   questionId: string;
   selectedAlternatives: number[];
   gradingOverride: CorrectionCaptureQuestionGradingOverride;
   reason?: string | null;
   note?: string | null;
};

export type CorrectionReviewQuestionState = {
   questionId: string;
   number: number;
   value: number;
   correctAlternative: number;
   omrSelectedAlternatives: number[];
   currentSelectedAlternatives: number[];
   gradingOverride: CorrectionCaptureQuestionGradingOverride;
   isCurrentCorrect: boolean | null;
   reason?: string | null;
   note?: string | null;
};

@Injectable()
export class CorrectionReviewGradingService {
   buildQuestionStates(input: {
      questions: ExamQuestionLike[];
      omrPayload?: Prisma.JsonValue | null;
      overrides?: ReviewOverrideLike[];
      existingItems?: ExistingCorrectionItemLike[];
   }): CorrectionReviewQuestionState[] {
      const omrSelections = this.extractOmrSelections(
         input.omrPayload,
         input.questions.length,
      );
      const existingSelectionMap = new Map(
         (input.existingItems ?? []).map((item) => [
            item.questionId,
            this.normalizeAlternatives(
               typeof item.selected === 'number' ? [item.selected] : [],
            ),
         ]),
      );
      const overrideMap = new Map(
         (input.overrides ?? []).map((item) => [item.questionId, item]),
      );

      return input.questions
         .slice()
         .sort((a, b) => a.number - b.number)
         .map((question, index) => {
            const baseAlternatives =
               omrSelections[index] ??
               existingSelectionMap.get(question.id) ??
               [];
            const override = overrideMap.get(question.id);
            const currentSelectedAlternatives = override
               ? this.normalizeAlternatives(override.selectedAlternatives)
               : baseAlternatives;
            const gradingOverride =
               override?.gradingOverride ??
               CorrectionCaptureQuestionGradingOverride.auto;

            return {
               questionId: question.id,
               number: question.number,
               value: question.value,
               correctAlternative: question.correct,
               omrSelectedAlternatives: baseAlternatives,
               currentSelectedAlternatives,
               gradingOverride,
               isCurrentCorrect: this.computeIsCorrect(
                  question.correct,
                  currentSelectedAlternatives,
                  gradingOverride,
               ),
               reason: override?.reason ?? null,
               note: override?.note ?? null,
            };
         });
   }

   computeGradedResult(states: CorrectionReviewQuestionState[]) {
      let score = 0;
      let correctAnswersCount = 0;
      let effectiveQuestionCount = 0;
      let effectiveMaxScore = 0;
      const correctionItems = states.map((state) => {
         const selected =
            state.currentSelectedAlternatives.length === 1
               ? state.currentSelectedAlternatives[0]
               : null;

         if (
            state.gradingOverride !==
            CorrectionCaptureQuestionGradingOverride.annulled
         ) {
            effectiveQuestionCount += 1;
            effectiveMaxScore += state.value;
         }

         if (state.isCurrentCorrect) {
            score += state.value;
            correctAnswersCount += 1;
         }

         return {
            questionId: state.questionId,
            selected,
            isCorrect: state.isCurrentCorrect,
            gradingOverride: state.gradingOverride,
            selectedAlternatives: state.currentSelectedAlternatives,
            reason: state.reason ?? null,
            note: state.note ?? null,
         };
      });

      return {
         score,
         correctAnswersCount,
         effectiveQuestionCount,
         effectiveMaxScore,
         correctionItems,
      };
   }

   private extractOmrSelections(
      omrPayload: Prisma.JsonValue | null | undefined,
      questionCount: number,
   ): number[][] {
      if (!omrPayload || typeof omrPayload !== 'object') {
         return Array.from({ length: questionCount }, () => []);
      }

      const omr = omrPayload as {
         answers?: Array<{
            question?: number;
            selected?: number | null;
            isAmbiguous?: boolean;
         }>;
         answers_numeric?: number[];
      };

      if (Array.isArray(omr.answers) && omr.answers.length > 0) {
         const values = Array.from(
            { length: questionCount },
            () => [] as number[],
         );

         for (const answer of omr.answers) {
            const questionIndex = (answer.question ?? 0) - 1;
            if (questionIndex < 0 || questionIndex >= questionCount) continue;

            if (answer.isAmbiguous) {
               values[questionIndex] = [];
               continue;
            }

            const selected =
               typeof answer.selected === 'number' &&
               answer.selected >= 1 &&
               answer.selected <= 5
                  ? [answer.selected]
                  : [];
            values[questionIndex] = selected;
         }

         return values;
      }

      const picks = Array.isArray(omr.answers_numeric)
         ? omr.answers_numeric
         : [];
      const values = Array.from(
         { length: questionCount },
         () => [] as number[],
      );

      for (let i = 0; i < questionCount; i += 1) {
         const pick = picks[i];

         if (typeof pick === 'number' && pick >= 0 && pick <= 4) {
            values[i] = [pick + 1];
         }
      }

      return values;
   }

   private normalizeAlternatives(values: number[]) {
      return Array.from(
         new Set(
            (values ?? []).filter(
               (value): value is number =>
                  Number.isInteger(value) && value >= 1 && value <= 5,
            ),
         ),
      ).sort((a, b) => a - b);
   }

   private computeIsCorrect(
      correctAlternative: number,
      selectedAlternatives: number[],
      gradingOverride: CorrectionCaptureQuestionGradingOverride,
   ) {
      switch (gradingOverride) {
         case CorrectionCaptureQuestionGradingOverride.correct:
            return true;
         case CorrectionCaptureQuestionGradingOverride.incorrect:
            return false;
         case CorrectionCaptureQuestionGradingOverride.annulled:
            return null;
         case CorrectionCaptureQuestionGradingOverride.auto:
         default:
            if (selectedAlternatives.length !== 1) {
               return null;
            }

            return selectedAlternatives[0] === correctAlternative;
      }
   }
}
