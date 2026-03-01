import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class VerifyInviteEmailCodeInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   challengeId!: string;

   @Field()
   @IsString()
   @MinLength(6)
   @MaxLength(6)
   code!: string;
}
