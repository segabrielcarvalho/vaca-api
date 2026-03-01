import { Field, Int, ObjectType } from '@nestjs/graphql';
import { SchoolMemberObject } from './school-member.object';

@ObjectType()
export class SchoolMemberListObject {
   @Field(() => Int)
   count!: number;

   @Field(() => [SchoolMemberObject])
   rows!: SchoolMemberObject[];
}
