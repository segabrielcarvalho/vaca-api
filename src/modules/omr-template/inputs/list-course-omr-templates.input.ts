import { Field, InputType, Int } from '@nestjs/graphql';
import {
   IsBoolean,
   IsInt,
   IsNotEmpty,
   IsOptional,
   IsString,
   Max,
   MaxLength,
   Min,
} from 'class-validator';

@InputType()
export class ListCourseOmrTemplatesInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   courseId!: string;

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

   @Field({ nullable: true })
   @IsOptional()
   @IsBoolean()
   isActive?: boolean;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   @MaxLength(120)
   nameSearch?: string;
}
