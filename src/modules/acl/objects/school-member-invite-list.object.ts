import { Field, Int, ObjectType } from '@nestjs/graphql';
import { SchoolMemberInviteObject } from './school-member-invite.object';

@ObjectType()
export class SchoolMemberInviteListObject {
   @Field(() => Int)
   count!: number;

   @Field(() => [SchoolMemberInviteObject])
   rows!: SchoolMemberInviteObject[];
}
