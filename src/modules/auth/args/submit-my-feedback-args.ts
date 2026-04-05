import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { SubmitMyFeedbackInput } from '../input';

@ArgsType()
export class SubmitMyFeedbackArgs {
   @Field(() => SubmitMyFeedbackInput)
   @ValidateNested()
   @Type(() => SubmitMyFeedbackInput)
   data!: SubmitMyFeedbackInput;
}
