import { Field, Float, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

@InputType()
export class RequeueCorrectionCaptureInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   captureId!: string;

   @Field(() => Float, { nullable: true })
   @IsOptional()
   @Min(0)
   @Max(1)
   threshold?: number;

   @Field(() => Float, { nullable: true })
   @IsOptional()
   @Min(0)
   @Max(1)
   delta?: number;
}
