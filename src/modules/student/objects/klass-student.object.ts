import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { KlassStudentEnrollmentObject } from './klass-student-enrollment.object';

@ObjectType()
export class KlassStudentObject {
   @Field()
   studentId!: string;

   @Field()
   userId!: string;

   @Field()
   registrationNumber!: string;

   @Field({ nullable: true })
   name?: string | null;

   @Field()
   email!: string;

   @Field()
   klassId!: string;

   @Field()
   schoolId!: string;

   @Field()
   enrollmentActive!: boolean;

   @Field(() => Date, { nullable: true })
   enrollmentStartedAt?: Date | null;

   @Field(() => Date, { nullable: true })
   enrollmentEndedAt?: Date | null;

   @Field(() => Date)
   createdAt!: Date;

   @Field(() => Date)
   updatedAt!: Date;

   @Field(() => [KlassStudentEnrollmentObject])
   @Type(() => KlassStudentEnrollmentObject)
   enrollments!: KlassStudentEnrollmentObject[];
}
