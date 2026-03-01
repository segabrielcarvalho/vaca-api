import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class GetCourseAdminSettingsInput {
   @Field()
   courseId!: string;
}
