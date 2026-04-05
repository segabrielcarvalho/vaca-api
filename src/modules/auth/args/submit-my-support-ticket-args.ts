import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { SubmitMySupportTicketInput } from '../input';

@ArgsType()
export class SubmitMySupportTicketArgs {
   @Field(() => SubmitMySupportTicketInput)
   @ValidateNested()
   @Type(() => SubmitMySupportTicketInput)
   data!: SubmitMySupportTicketInput;
}
