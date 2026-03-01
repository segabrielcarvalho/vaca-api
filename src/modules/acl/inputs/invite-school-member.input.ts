import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class InviteSchoolMemberInput {
   @Field()
   schoolId!: string;

   @Field({ nullable: true })
   courseId?: string;

   @Field({ nullable: true })
   klassId?: string;

   @Field()
   email!: string;

   @Field({ nullable: true })
   schoolRoleCode?: string;

   @Field({ nullable: true })
   roleCode?: string;
}
