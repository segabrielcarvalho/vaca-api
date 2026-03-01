import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { ConsumeEmailLoginMagicLinkInput } from '../input';

@ArgsType()
export class ConsumeEmailLoginMagicLinkArgs {
   @Field(() => ConsumeEmailLoginMagicLinkInput)
   @ValidateNested()
   @Type(() => ConsumeEmailLoginMagicLinkInput)
   data!: ConsumeEmailLoginMagicLinkInput;
}
