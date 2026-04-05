import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { CorrectionDashboardDayObject } from './correction-dashboard-day.object';

@ObjectType()
export class CorrectionDashboardObject {
   @Field(() => Int)
   totalQuestionCount!: number;

   @Field(() => Int)
   totalCaptureCount!: number;

   @Field(() => Int)
   totalNeedsReviewCount!: number;

   @Field(() => [CorrectionDashboardDayObject])
   @Type(() => CorrectionDashboardDayObject)
   days!: CorrectionDashboardDayObject[];
}
