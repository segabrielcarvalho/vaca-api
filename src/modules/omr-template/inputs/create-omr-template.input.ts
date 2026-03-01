import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

@InputType()
export class CreateOmrTemplateInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   courseId!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   @MaxLength(120)
   name!: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   @MaxLength(500)
   description?: string;
}
