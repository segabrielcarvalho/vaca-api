import { ArgsType, Field } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CreateUserInput } from '../inputs/create-user.input';

@ArgsType()
export class CreateUserArgs {
   @ValidateNested()
   @Type(() => CreateUserInput)
   @Field(() => CreateUserInput, { nullable: false })
   data!: CreateUserInput;
}
