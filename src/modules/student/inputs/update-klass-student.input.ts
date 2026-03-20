import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateKlassStudentInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   klassId!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   studentId!: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   name?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   registrationNumber?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsEmail()
   email?: string;
}
