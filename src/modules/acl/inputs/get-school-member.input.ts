import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class GetSchoolMemberInput {
   @Field()
   schoolId!: string;

   @Field({ nullable: true })
   courseId?: string;

   @Field({ nullable: true })
   klassId?: string;

   @Field()
   agentId!: string;
}
