import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class KlassStudentEnrollmentObject {
   @Field(() => Date)
   startedAt!: Date;

   @Field(() => Date, { nullable: true })
   endedAt?: Date | null;

   @Field()
   active!: boolean;
}
