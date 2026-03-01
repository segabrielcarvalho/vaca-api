import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class ConsumeInviteMagicLinkInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   token!: string;
}
