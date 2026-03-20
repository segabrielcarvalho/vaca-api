import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class StudentDetailKlassObject {
   @Field()
   klassId!: string;

   @Field()
   klassName!: string;

   @Field()
   courseId!: string;

   @Field()
   courseName!: string;

   @Field(() => Date)
   startedAt!: Date;

   @Field(() => Date, { nullable: true })
   endedAt?: Date | null;

   @Field()
   active!: boolean;
}
