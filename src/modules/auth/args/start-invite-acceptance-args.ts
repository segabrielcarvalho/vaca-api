import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { StartInviteAcceptanceInput } from '../input';

@ArgsType()
export class StartInviteAcceptanceArgs {
   @Field(() => StartInviteAcceptanceInput)
   @ValidateNested()
   @Type(() => StartInviteAcceptanceInput)
   data!: StartInviteAcceptanceInput;
}
