import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import {
   CorrectionCaptureReviewReason as PrismaCorrectionCaptureReviewReason,
   CorrectionCaptureStatus as PrismaCorrectionCaptureStatus,
} from '../../../../.prisma/client';
import { CorrectionCaptureReviewReason } from '../../graphql/@generated/prisma/correction-capture-review-reason.enum';
import { CorrectionCaptureStatus } from '../../graphql/@generated/prisma/correction-capture-status.enum';
import { CorrectionCaptureReviewAuditLogObject } from './correction-capture-review-audit-log.object';
import { CorrectionCaptureReviewQuestionObject } from './correction-capture-review-question.object';
import { CorrectionCaptureReviewStudentObject } from './correction-capture-review-student.object';

@ObjectType()
export class CorrectionCaptureReviewObject {
   @Field()
   captureId!: string;

   @Field()
   sessionId!: string;

   @Field()
   examId!: string;

   @Field()
   klassId!: string;

   @Field()
   examTitle!: string;

   @Field(() => Int)
   questionCount!: number;

   @Field(() => CorrectionCaptureStatus)
   status!: PrismaCorrectionCaptureStatus;

   @Field(() => [CorrectionCaptureReviewReason])
   reviewReasons!: PrismaCorrectionCaptureReviewReason[];

   @Field({ nullable: true })
   reviewNotes?: string | null;

   @Field({ nullable: true })
   errorMessage?: string | null;

   @Field({ nullable: true })
   registrationNumber?: string | null;

   @Field({ nullable: true })
   previewImageUrl?: string | null;

   @Field(() => Date)
   createdAt!: Date;

   @Field(() => Date)
   updatedAt!: Date;

   @Field(() => CorrectionCaptureReviewStudentObject, { nullable: true })
   student?: CorrectionCaptureReviewStudentObject | null;

   @Field({ nullable: true })
   correctionExamId?: string | null;

   @Field(() => Float, { nullable: true })
   score?: number | null;

   @Field(() => [CorrectionCaptureReviewQuestionObject])
   questions!: CorrectionCaptureReviewQuestionObject[];

   @Field(() => [CorrectionCaptureReviewAuditLogObject])
   auditLogs!: CorrectionCaptureReviewAuditLogObject[];
}
