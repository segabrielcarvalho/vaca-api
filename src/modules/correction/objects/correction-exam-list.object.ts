import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { CorrectionExam } from '../../graphql/@generated/correction-exam/correction-exam.model';
import { DefaultListObject } from '../../graphql/objects/default-list-object';

@ObjectType()
export class CorrectionExamListObject extends DefaultListObject {
   @Field(() => [CorrectionExam])
   @Type(() => CorrectionExam)
   rows!: CorrectionExam[];
}
