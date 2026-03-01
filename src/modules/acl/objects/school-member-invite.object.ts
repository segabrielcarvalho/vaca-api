import { Field, ObjectType } from '@nestjs/graphql';
import { SchoolMemberInviteStatus } from './school-member-invite-status.enum';

@ObjectType()
export class SchoolMemberInviteObject {
   @Field()
   inviteId!: string;

   @Field()
   email!: string;

   @Field()
   userId!: string;

   @Field({ nullable: true })
   agentId?: string | null;

   @Field(() => String, { nullable: true })
   schoolRoleCode?: string | null;

   @Field(() => SchoolMemberInviteStatus)
   status!: SchoolMemberInviteStatus;

   @Field(() => Date)
   createdAt!: Date;

   @Field(() => Date)
   expiresAt!: Date;

   @Field(() => Date, { nullable: true })
   acceptedAt?: Date | null;

   @Field(() => Date, { nullable: true })
   revokedAt?: Date | null;

   @Field()
   isExpired!: boolean;

   @Field({ nullable: true })
   invitedByUserId?: string | null;
}
