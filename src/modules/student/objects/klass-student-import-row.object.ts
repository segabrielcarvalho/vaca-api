import { Field, ObjectType } from '@nestjs/graphql';
import { KlassStudentImportRowStatusEnum } from '../enums/klass-student-import-row-status.enum';

@ObjectType()
export class KlassStudentImportRowObject {
   @Field()
   rowNumber!: number;

   @Field({ nullable: true })
   name?: string | null;

   @Field({ nullable: true })
   registrationNumber?: string | null;

   @Field({ nullable: true })
   email?: string | null;

   @Field(() => KlassStudentImportRowStatusEnum)
   status!: KlassStudentImportRowStatusEnum;

   @Field({ nullable: true })
   message?: string | null;

   @Field({ nullable: true })
   studentId?: string | null;
}
