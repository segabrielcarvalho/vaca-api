import { Field, InputType } from '@nestjs/graphql';
import { AuthChannelEnum } from '../../graphql/@generated/prisma/auth-channel.enum';
import { IsEnum, IsOptional, IsString } from 'class-validator';

@InputType()
export class LogoutCurrentSessionInput {
   @Field(() => AuthChannelEnum)
   @IsEnum(AuthChannelEnum)
   channel!: AuthChannelEnum;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   refreshToken?: string;
}
