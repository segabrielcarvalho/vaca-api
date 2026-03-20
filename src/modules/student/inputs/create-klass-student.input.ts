import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class CreateKlassStudentInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   klassId!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   name!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   registrationNumber!: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsEmail()
   email?: string;
}
