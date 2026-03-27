import { Field, InputType, Int } from '@nestjs/graphql';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CorrectionCaptureQuestionGradingOverride } from '../../graphql/@generated/prisma/correction-capture-question-grading-override.enum';

@InputType()
export class CorrectionCaptureReviewQuestionInput {
   @Field()
   @IsUUID()
   questionId!: string;

   @Field(() => [Int], { nullable: true })
   @IsOptional()
   @IsArray()
   selectedAlternatives?: number[];

   @Field(() => CorrectionCaptureQuestionGradingOverride, {
      nullable: true,
   })
   @IsOptional()
   @IsEnum(CorrectionCaptureQuestionGradingOverride)
   gradingOverride?: CorrectionCaptureQuestionGradingOverride;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   reason?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   note?: string;
}
