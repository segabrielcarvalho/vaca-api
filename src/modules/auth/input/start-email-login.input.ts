import { Field, InputType } from '@nestjs/graphql';
import { AuthChannelEnum } from '../../graphql/@generated/prisma/auth-channel.enum';
import {
   IsEmail,
   IsEnum,
   IsNotEmpty,
   IsOptional,
   IsString,
   Matches,
} from 'class-validator';

@InputType()
export class StartEmailLoginInput {
   @Field()
   @IsEmail()
   email!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   @Matches(/^[A-Za-z0-9]+$/, {
      message: 'institutionCode deve conter apenas caracteres alfanumericos.',
   })
   institutionCode!: string;

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
