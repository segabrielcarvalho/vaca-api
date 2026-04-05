import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CorrectionDashboardDayObject {
   @Field()
   dateKey!: string;

   @Field()
   label!: string;

   @Field(() => Int)
   questionCount!: number;

   @Field(() => Int)
   captureCount!: number;

   @Field(() => Int)
   needsReviewCount!: number;
}
