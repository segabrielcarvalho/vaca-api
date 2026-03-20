import { Field, InputType, Int } from '@nestjs/graphql';
import {
   IsInt,
   IsNotEmpty,
   IsOptional,
   IsString,
   Max,
   Min,
} from 'class-validator';

@InputType()
export class ListExamCorrectionsInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   examId!: string;

   @Field(() => Int, { nullable: true, defaultValue: 0 })
   @IsOptional()
   @IsInt()
   @Min(0)
   skip?: number;

   @Field(() => Int, { nullable: true, defaultValue: 20 })
   @IsOptional()
   @IsInt()
   @Min(1)
   @Max(100)
   take?: number;
}
