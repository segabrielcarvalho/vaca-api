import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { StudentDetailExamObject } from './student-detail-exam.object';
import { StudentDetailKlassObject } from './student-detail-klass.object';
import { StudentDetailResultObject } from './student-detail-result.object';

@ObjectType()
export class StudentDetailObject {
   @Field()
   studentId!: string;

   @Field()
   userId!: string;

   @Field()
   schoolId!: string;

   @Field()
   registrationNumber!: string;

   @Field({ nullable: true })
   name?: string | null;

   @Field()
   email!: string;

   @Field(() => Date)
   createdAt!: Date;

   @Field(() => Date)
   updatedAt!: Date;

   @Field(() => Int)
   activeEnrollmentCount!: number;

   @Field(() => Int)
   examCount!: number;

   @Field(() => Int)
   resultCount!: number;

   @Field(() => Float, { nullable: true })
   averageScore?: number | null;

   @Field({ nullable: true })
   currentKlassId?: string | null;

   @Field({ nullable: true })
   currentKlassName?: string | null;

   @Field(() => [StudentDetailKlassObject])
   @Type(() => StudentDetailKlassObject)
   klasses!: StudentDetailKlassObject[];

   @Field(() => [StudentDetailExamObject])
   @Type(() => StudentDetailExamObject)
   exams!: StudentDetailExamObject[];

   @Field(() => [StudentDetailResultObject])
   @Type(() => StudentDetailResultObject)
   results!: StudentDetailResultObject[];
}
