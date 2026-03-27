import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { CorrectionCaptureQuestionGradingOverride } from '../../graphql/@generated/prisma/correction-capture-question-grading-override.enum';

@ObjectType()
export class CorrectionCaptureReviewQuestionObject {
   @Field()
   questionId!: string;

   @Field(() => Int)
   number!: number;

   @Field(() => Float)
   value!: number;

   @Field(() => Int)
   correctAlternative!: number;

   @Field(() => [Int])
   omrSelectedAlternatives!: number[];

   @Field(() => [Int])
   currentSelectedAlternatives!: number[];

   @Field(() => CorrectionCaptureQuestionGradingOverride)
   gradingOverride!: CorrectionCaptureQuestionGradingOverride;

   @Field(() => Boolean, { nullable: true })
   isCurrentCorrect!: boolean | null;

   @Field({ nullable: true })
   reason?: string | null;

   @Field({ nullable: true })
   note?: string | null;
}
