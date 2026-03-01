import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class ListSchoolMembersInput {
   @Field()
   schoolId!: string;

   @Field({ nullable: true })
   courseId?: string;

   @Field({ nullable: true })
   klassId?: string;

   @Field({ nullable: true })
   search?: string;

   @Field({ nullable: true })
   isActive?: boolean;

   @Field(() => Int, { nullable: true })
   skip?: number;

   @Field(() => Int, { nullable: true })
   take?: number;
}
