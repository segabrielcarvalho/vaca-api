import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { StartEmailLoginInput } from '../input';

@ArgsType()
export class StartEmailLoginArgs {
   @Field(() => StartEmailLoginInput)
   @ValidateNested()
   @Type(() => StartEmailLoginInput)
   data!: StartEmailLoginInput;
}
