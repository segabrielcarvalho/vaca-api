import { Field, InputType, Int } from '@nestjs/graphql';
import {
   IsEnum,
   IsInt,
   IsNotEmpty,
   IsOptional,
   IsString,
   Max,
   Min,
} from 'class-validator';
import { KlassStudentEnrollmentStatusEnum } from '../enums/klass-student-enrollment-status.enum';

@InputType()
export class ListKlassStudentsInput {
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

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   search?: string;

   @Field(() => KlassStudentEnrollmentStatusEnum, {
      nullable: true,
      defaultValue: KlassStudentEnrollmentStatusEnum.active,
   })
   @IsOptional()
   @IsEnum(KlassStudentEnrollmentStatusEnum)
   status?: KlassStudentEnrollmentStatusEnum;
}
