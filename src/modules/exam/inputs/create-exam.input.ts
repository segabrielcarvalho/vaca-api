import { Field, Float, InputType, Int } from '@nestjs/graphql';
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
export class CreateExamInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   klassId!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   title!: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   description?: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   templateVersionId!: string;

   @Field(() => [Int])
   @IsArray()
   @ArrayMinSize(10)
   @ArrayMaxSize(60)
   @IsInt({ each: true })
   @Min(1, { each: true })
   @Max(5, { each: true })
   answerKey!: number[];

   @Field(() => Float, { nullable: true, defaultValue: 1 })
   @IsOptional()
   @Min(0.1)
   questionValue?: number;
}
