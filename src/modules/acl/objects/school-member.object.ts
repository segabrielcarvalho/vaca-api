import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SchoolMemberObject {
   @Field()
   agentId!: string;

   @Field()
   userId!: string;

   @Field()
   email!: string;

   @Field({ nullable: true })
   name?: string | null;

   @Field()
   hasProfile!: boolean;

   @Field(() => Date, { nullable: true })
   profileCompletedAt?: Date | null;

   @Field(() => String, { nullable: true })
   schoolRoleCode?: string | null;

   @Field()
   coursePermissionsCount!: number;

   @Field()
   klassPermissionsCount!: number;

   @Field()
   isActive!: boolean;
}
