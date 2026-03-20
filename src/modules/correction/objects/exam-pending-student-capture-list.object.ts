import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { DefaultListObject } from '../../graphql/objects/default-list-object';
import { ExamPendingStudentCaptureObject } from './exam-pending-student-capture.object';

@ObjectType()
export class ExamPendingStudentCaptureListObject extends DefaultListObject {
   @Field(() => [ExamPendingStudentCaptureObject])
   @Type(() => ExamPendingStudentCaptureObject)
   rows!: ExamPendingStudentCaptureObject[];
}
