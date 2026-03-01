import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class RevokeSchoolMemberInviteInput {
   @Field()
   schoolId!: string;

   @Field({ nullable: true })
   courseId?: string;

   @Field({ nullable: true })
   klassId?: string;

   @Field()
   inviteId!: string;
}
