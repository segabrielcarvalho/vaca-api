import { registerEnumType } from '@nestjs/graphql';

export enum CorrectionCaptureReviewOutcomeEnum {
   graded = 'graded',
   needs_review = 'needs_review',
   invalidated = 'invalidated',
}

registerEnumType(CorrectionCaptureReviewOutcomeEnum, {
   name: 'CorrectionCaptureReviewOutcome',
});
