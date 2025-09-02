import { Field, InputType, PartialType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

@InputType()
export class NestedBoolFilter {
   @Field(() => Boolean)
   equals!: boolean;
}

@InputType()
export class BoolFilter extends PartialType(NestedBoolFilter) {
   @ValidateNested()
   @Type(() => NestedBoolFilter)
   @Field(() => NestedBoolFilter, { nullable: true })
   not?: NestedBoolFilter;
}
