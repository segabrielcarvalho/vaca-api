import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { ConsumeInviteMagicLinkInput } from '../input';

@ArgsType()
export class ConsumeInviteMagicLinkArgs {
   @Field(() => ConsumeInviteMagicLinkInput)
   @ValidateNested()
   @Type(() => ConsumeInviteMagicLinkInput)
   data!: ConsumeInviteMagicLinkInput;
}
