import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class DeleteExamInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   examId!: string;
}
