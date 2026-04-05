import { Field, InputType } from '@nestjs/graphql';
import {
   IsNotEmpty,
   IsOptional,
   IsString,
   MaxLength,
   MinLength,
} from 'class-validator';

@InputType()
export class UpdateMyProfileInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   @MinLength(2)
   @MaxLength(120)
   name!: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   @IsNotEmpty()
   photoBase64?: string;
}
