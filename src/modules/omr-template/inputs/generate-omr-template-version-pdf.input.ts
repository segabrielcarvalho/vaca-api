import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class GenerateOmrTemplateVersionPdfInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   templateVersionId!: string;
}
