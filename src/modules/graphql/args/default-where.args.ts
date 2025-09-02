import { ArgsType, Field } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { DefaultWhereIdInput } from '../inputs/default-where-id.input';

@ArgsType()
export class DefaultWhereArgs {
   @ValidateNested()
   @Type(() => DefaultWhereIdInput)
   @Field(() => DefaultWhereIdInput, { nullable: false })
   where!: DefaultWhereIdInput;
}
