import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class GetSchoolAdminSettingsInput {
   @Field()
   schoolId!: string;
}
