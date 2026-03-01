import { Field, InputType } from '@nestjs/graphql';
import { AuthChannelEnum } from '../../graphql/@generated/prisma/auth-channel.enum';
import {
   IsEnum,
   IsNotEmpty,
   IsOptional,
   IsString,
   MaxLength,
   MinLength,
} from 'class-validator';

@InputType()
export class VerifyEmailLoginCodeInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   challengeId!: string;

   @Field()
   @IsString()
   @MinLength(6)
   @MaxLength(6)
   code!: string;

   @Field(() => AuthChannelEnum)
   @IsEnum(AuthChannelEnum)
   channel!: AuthChannelEnum;

   @Field()
   @IsString()
   @IsNotEmpty()
   deviceId!: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   deviceName?: string;
}
