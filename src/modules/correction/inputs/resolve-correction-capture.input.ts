import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CorrectionCaptureStatus as PrismaCorrectionCaptureStatus } from '../../../../.prisma/client';
import { CorrectionCaptureStatus as GqlCorrectionCaptureStatus } from '../../graphql/@generated/prisma/correction-capture-status.enum';
import { CorrectionCaptureReviewReason as GqlCorrectionCaptureReviewReason } from '../../graphql/@generated/prisma/correction-capture-review-reason.enum';
import { CorrectionCaptureReviewReason as PrismaCorrectionCaptureReviewReason } from '../../../../.prisma/client';

@InputType()
export class ResolveCorrectionCaptureInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   captureId!: string;

   @Field(() => GqlCorrectionCaptureStatus)
   status!: PrismaCorrectionCaptureStatus;

   @Field(() => [GqlCorrectionCaptureReviewReason], { nullable: true })
   @IsOptional()
   reviewReasons?: PrismaCorrectionCaptureReviewReason[];

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   reviewNotes?: string;
}
