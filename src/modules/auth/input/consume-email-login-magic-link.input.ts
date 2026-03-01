import { Field, InputType } from '@nestjs/graphql';
import { AuthChannelEnum } from '../../graphql/@generated/prisma/auth-channel.enum';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class ConsumeEmailLoginMagicLinkInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   token!: string;

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
