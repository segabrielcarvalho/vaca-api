import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class ArchiveOmrTemplateInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   templateId!: string;
}
