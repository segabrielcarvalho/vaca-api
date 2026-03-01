import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { RefreshAuthSessionInput } from '../input';

@ArgsType()
export class RefreshAuthSessionArgs {
   @Field(() => RefreshAuthSessionInput)
   @ValidateNested()
   @Type(() => RefreshAuthSessionInput)
   data!: RefreshAuthSessionInput;
}
