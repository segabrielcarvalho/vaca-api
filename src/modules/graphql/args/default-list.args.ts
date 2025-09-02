import { ArgsType, Field, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ListDefaultInput } from '../inputs/find-many-default.input';

@ArgsType()
export class DefaultListArgs {
   @ValidateNested()
   @Type(() => ListDefaultInput)
   @Field(() => ListDefaultInput, { nullable: true })
   orderBy?: ListDefaultInput;

   @Field(() => Int, { nullable: true })
   skip?: number;

   @Field(() => Int, { nullable: true })
   take?: number;
}
