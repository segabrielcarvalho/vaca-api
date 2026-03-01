import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class GetExamInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   examId!: string;
}
