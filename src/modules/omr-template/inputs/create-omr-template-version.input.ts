import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class CreateOmrTemplateVersionInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   templateId!: string;

   @Field({
      description:
         'Layout serializado em JSON string. Deve conter questionsBlock.questionCount (10..60, de 5 em 5).',
   })
   @IsString()
   @IsNotEmpty()
   layoutJson!: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   pdfBase64?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   previewImageBase64?: string;
}
