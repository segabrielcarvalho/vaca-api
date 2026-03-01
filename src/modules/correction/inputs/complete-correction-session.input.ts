import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CompleteCorrectionSessionInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   sessionId!: string;
}
