import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { CompleteInviteProfileInput } from '../input';

@ArgsType()
export class CompleteInviteProfileArgs {
   @Field(() => CompleteInviteProfileInput)
   @ValidateNested()
   @Type(() => CompleteInviteProfileInput)
   data!: CompleteInviteProfileInput;
}
