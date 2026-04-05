import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class StudentDetailExamObject {
   @Field()
   examId!: string;

   @Field()
   title!: string;

   @Field()
   klassId!: string;

   @Field()
   klassName!: string;

   @Field()
   courseId!: string;

   @Field()
   courseName!: string;

   @Field()
   isActive!: boolean;

   @Field(() => Float, { nullable: true })
   bestScore?: number | null;

   @Field(() => Date, { nullable: true })
   lastCorrectionAt?: Date | null;
}
