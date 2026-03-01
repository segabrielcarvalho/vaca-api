import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { VerifyInviteEmailCodeInput } from '../input';

@ArgsType()
export class VerifyInviteEmailCodeArgs {
   @Field(() => VerifyInviteEmailCodeInput)
   @ValidateNested()
   @Type(() => VerifyInviteEmailCodeInput)
   data!: VerifyInviteEmailCodeInput;
}
