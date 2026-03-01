import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { VerifyEmailLoginCodeInput } from '../input';

@ArgsType()
export class VerifyEmailLoginCodeArgs {
   @Field(() => VerifyEmailLoginCodeInput)
   @ValidateNested()
   @Type(() => VerifyEmailLoginCodeInput)
   data!: VerifyEmailLoginCodeInput;
}
