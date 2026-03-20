import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class ImportKlassStudentsCsvInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   klassId!: string;

   @Field()
   @IsString()
   @IsNotEmpty()
   csvContent!: string;
}
