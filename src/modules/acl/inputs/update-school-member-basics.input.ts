import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateSchoolMemberBasicsInput {
   @Field()
   schoolId!: string;

   @Field({ nullable: true })
   courseId?: string;

   @Field({ nullable: true })
   klassId?: string;

   @Field()
   agentId!: string;

   @Field()
   name!: string;
}
