import { Field, InputType } from '@nestjs/graphql';
import { AuthChannelEnum } from '../../graphql/@generated/prisma/auth-channel.enum';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class StartInviteAcceptanceInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   inviteToken!: string;

   @Field(() => AuthChannelEnum)
   @IsEnum(AuthChannelEnum)
   channel!: AuthChannelEnum;
}
