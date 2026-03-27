import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CorrectionCaptureReviewReason as PrismaCorrectionCaptureReviewReason } from '../../../../.prisma/client';
import { CorrectionCaptureReviewReason } from '../../graphql/@generated/prisma/correction-capture-review-reason.enum';
import { CorrectionCaptureReviewOutcomeEnum } from '../enums/correction-capture-review-outcome.enum';
import { CorrectionCaptureReviewQuestionInput } from './correction-capture-review-question.input';

@InputType()
export class FinalizeCorrectionCaptureReviewInput {
   @Field()
   @IsUUID()
   captureId!: string;

   @Field(() => CorrectionCaptureReviewOutcomeEnum)
   @IsEnum(CorrectionCaptureReviewOutcomeEnum)
   outcome!: CorrectionCaptureReviewOutcomeEnum;

   @Field({ nullable: true })
   @IsOptional()
   @IsUUID()
   studentId?: string;

   @Field(() => [CorrectionCaptureReviewReason], { nullable: true })
   @IsOptional()
   reviewReasons?: PrismaCorrectionCaptureReviewReason[];

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   reviewNotes?: string;

   @Field(() => [CorrectionCaptureReviewQuestionInput], { nullable: true })
   @IsOptional()
   questionOverrides?: CorrectionCaptureReviewQuestionInput[];
}
