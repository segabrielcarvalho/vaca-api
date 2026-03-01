import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { LogoutCurrentSessionInput } from '../input';

@ArgsType()
export class LogoutCurrentSessionArgs {
   @Field(() => LogoutCurrentSessionInput)
   @ValidateNested()
   @Type(() => LogoutCurrentSessionInput)
   data!: LogoutCurrentSessionInput;
}
