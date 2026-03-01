import { Field, InputType, Int } from '@nestjs/graphql';
import { SchoolMemberInviteStatus } from '../objects/school-member-invite-status.enum';

@InputType()
export class ListSchoolMemberInvitesInput {
   @Field()
   schoolId!: string;

   @Field({ nullable: true })
   courseId?: string;

   @Field({ nullable: true })
   klassId?: string;

   @Field({ nullable: true })
   search?: string;

   @Field(() => SchoolMemberInviteStatus, { nullable: true })
   status?: SchoolMemberInviteStatus;

   @Field(() => Int, { nullable: true })
   skip?: number;

   @Field(() => Int, { nullable: true })
   take?: number;
}
