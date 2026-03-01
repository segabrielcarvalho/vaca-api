import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArgsType, Field } from '@nestjs/graphql';
import { CreateSchoolInput } from '../input/create-school.input';

@ArgsType()
export class CreateSchoolArgs {
   @Field(() => CreateSchoolInput)
   @ValidateNested()
   @Type(() => CreateSchoolInput)
   data!: CreateSchoolInput;
}
