import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { CorrectionStatus as PrismaCorrectionStatus } from '../../../../.prisma/client';
import { CorrectionStatus } from '../../graphql/@generated/prisma/correction-status.enum';

@ObjectType()
export class StudentDetailResultObject {
   @Field()
   correctionId!: string;

   @Field()
   examId!: string;

   @Field()
   examTitle!: string;

   @Field()
   klassId!: string;

   @Field()
   klassName!: string;

   @Field()
   courseId!: string;

   @Field()
   courseName!: string;

   @Field(() => Int)
   attempt!: number;

   @Field(() => Float, { nullable: true })
   score?: number | null;

   @Field(() => CorrectionStatus)
   status!: PrismaCorrectionStatus;

   @Field(() => Int)
   correctAnswersCount!: number;

   @Field(() => Int)
   questionCount!: number;

   @Field(() => Date)
   submittedAt!: Date;
}
