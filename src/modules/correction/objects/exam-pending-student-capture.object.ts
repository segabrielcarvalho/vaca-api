import { Field, ObjectType } from '@nestjs/graphql';
import {
   CorrectionCaptureReviewReason as PrismaCorrectionCaptureReviewReason,
   CorrectionCaptureStatus as PrismaCorrectionCaptureStatus,
} from '../../../../.prisma/client';
import { CorrectionCaptureReviewReason } from '../../graphql/@generated/prisma/correction-capture-review-reason.enum';
import { CorrectionCaptureStatus } from '../../graphql/@generated/prisma/correction-capture-status.enum';

@ObjectType()
export class ExamPendingStudentCaptureObject {
   @Field()
   captureId!: string;

   @Field()
   sessionId!: string;

   @Field(() => CorrectionCaptureStatus)
   status!: PrismaCorrectionCaptureStatus;

   @Field({ nullable: true })
   registrationNumber?: string | null;

   @Field(() => [CorrectionCaptureReviewReason])
   reviewReasons!: PrismaCorrectionCaptureReviewReason[];

   @Field({ nullable: true })
   reviewNotes?: string | null;

   @Field(() => Date)
   createdAt!: Date;

   @Field({ nullable: true })
   matchedStudentId?: string | null;

   @Field({ nullable: true })
   matchedStudentName?: string | null;

   @Field({ nullable: true })
   matchedStudentEmail?: string | null;

   @Field({ nullable: true })
   matchedStudentRegistrationNumber?: string | null;
}
