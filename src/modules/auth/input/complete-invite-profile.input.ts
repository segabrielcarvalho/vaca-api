import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CompleteInviteProfileInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   contextId!: string;

   @Field()
   @IsString()
   @MinLength(2)
   @MaxLength(120)
   name!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   phoneE164!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   photoBase64!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   timezone!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   locale!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   notificationPrefsJson!: string;
}
