import { Field, InputType } from '@nestjs/graphql';
import {
   IsEnum,
   IsNotEmpty,
   IsString,
   MaxLength,
   MinLength,
} from 'class-validator';
import { SupportTicketCategoryEnum } from '../../graphql/@generated/prisma/support-ticket-category.enum';

@InputType()
export class SubmitMySupportTicketInput {
   @Field(() => SupportTicketCategoryEnum)
   @IsEnum(SupportTicketCategoryEnum)
   category!: SupportTicketCategoryEnum;

   @Field()
   @IsString()
   @IsNotEmpty()
   @MinLength(8)
   @MaxLength(30)
   contactPhone!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   @MinLength(5)
   @MaxLength(2000)
   message!: string;
}
