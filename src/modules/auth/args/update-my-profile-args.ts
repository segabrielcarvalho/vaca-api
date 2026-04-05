import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { UpdateMyProfileInput } from '../input';

@ArgsType()
export class UpdateMyProfileArgs {
   @Field(() => UpdateMyProfileInput)
   @ValidateNested()
   @Type(() => UpdateMyProfileInput)
   data!: UpdateMyProfileInput;
}
