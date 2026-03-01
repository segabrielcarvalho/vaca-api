import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { InviteUserInput } from '../input';

@ArgsType()
export class InviteUserArgs {
   @Field(() => InviteUserInput)
   @ValidateNested()
   @Type(() => InviteUserInput)
   data!: InviteUserInput;
}
