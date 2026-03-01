import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class GetOmrTemplateInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   templateId!: string;
}
