import { Field, InputType } from '@nestjs/graphql';
import {
   IsEnum,
   IsNotEmpty,
   IsString,
   MaxLength,
   MinLength,
} from 'class-validator';
import { AppFeedbackCategoryEnum } from '../../graphql/@generated/prisma/app-feedback-category.enum';

@InputType()
export class SubmitMyFeedbackInput {
   @Field(() => AppFeedbackCategoryEnum)
   @IsEnum(AppFeedbackCategoryEnum)
   category!: AppFeedbackCategoryEnum;

   @Field()
   @IsString()
   @IsNotEmpty()
   @MinLength(5)
   @MaxLength(2000)
   message!: string;
}
