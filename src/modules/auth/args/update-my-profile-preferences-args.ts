import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { UpdateMyProfilePreferencesInput } from '../input';

@ArgsType()
export class UpdateMyProfilePreferencesArgs {
   @Field(() => UpdateMyProfilePreferencesInput)
   @ValidateNested()
   @Type(() => UpdateMyProfilePreferencesInput)
   data!: UpdateMyProfilePreferencesInput;
}
