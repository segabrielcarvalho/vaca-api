import { Field, InputType, Int } from '@nestjs/graphql';
import {
   ArrayMaxSize,
   ArrayMinSize,
   IsArray,
   IsInt,
   IsNotEmpty,
   IsOptional,
   IsString,
   Max,
   Min,
} from 'class-validator';

@InputType()
export class UpdateExamInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   examId!: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   title?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   description?: string;

   @Field(() => [Int], { nullable: true })
   @IsOptional()
   @IsArray()
   @ArrayMinSize(10)
   @ArrayMaxSize(60)
   @IsInt({ each: true })
   @Min(1, { each: true })
   @Max(5, { each: true })
   answerKey?: number[];
}
