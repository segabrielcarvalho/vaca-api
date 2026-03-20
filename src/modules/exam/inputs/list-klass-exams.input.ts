import { Field, InputType, Int } from '@nestjs/graphql';
import {
   IsBoolean,
   IsInt,
   IsNotEmpty,
   IsOptional,
   IsString,
   Max,
   Min,
} from 'class-validator';

@InputType()
export class ListKlassExamsInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   klassId!: string;

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

   @Field(() => Boolean, { nullable: true })
   @IsOptional()
   @IsBoolean()
   isActive?: boolean;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   search?: string;
}
