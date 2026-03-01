import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { Exam } from '../../graphql/@generated/exam/exam.model';
import { DefaultListObject } from '../../graphql/objects/default-list-object';

@ObjectType()
export class ExamListObject extends DefaultListObject {
   @Field(() => [Exam])
   @Type(() => Exam)
   rows!: Exam[];
}
