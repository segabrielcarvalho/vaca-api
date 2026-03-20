import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class GetStudentDetailInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   studentId!: string;
}
