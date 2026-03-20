import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { KlassStudentImportRowObject } from './klass-student-import-row.object';

@ObjectType()
export class KlassStudentImportResultObject {
   @Field(() => Int)
   totalRows!: number;

   @Field(() => Int)
   processedRows!: number;

   @Field(() => Int)
   createdCount!: number;

   @Field(() => Int)
   linkedCount!: number;

   @Field(() => Int)
   reactivatedCount!: number;

   @Field(() => Int)
   alreadyActiveCount!: number;

   @Field(() => Int)
   errorCount!: number;

   @Field(() => [KlassStudentImportRowObject])
   @Type(() => KlassStudentImportRowObject)
   rows!: KlassStudentImportRowObject[];
}
