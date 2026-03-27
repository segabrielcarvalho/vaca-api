import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { CorrectionCaptureReviewReason as PrismaCorrectionCaptureReviewReason } from '../../../../.prisma/client';
import { CorrectionCaptureReviewReason } from '../../graphql/@generated/prisma/correction-capture-review-reason.enum';
import { CorrectionCaptureReviewQuestionInput } from './correction-capture-review-question.input';

@InputType()
export class SaveCorrectionCaptureReviewDraftInput {
   @Field()
   @IsUUID()
   captureId!: string;

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
