import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SchoolMemberScopeOptionObject {
   @Field()
   id!: string;

   @Field()
   name!: string;

   @Field({ nullable: true })
   courseId?: string | null;

   @Field({ nullable: true })
   courseName?: string | null;
}
