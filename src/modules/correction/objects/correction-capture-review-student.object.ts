import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CorrectionCaptureReviewStudentObject {
   @Field()
   id!: string;

   @Field({ nullable: true })
   registrationNumber?: string | null;

   @Field({ nullable: true })
   name?: string | null;

   @Field({ nullable: true })
   email?: string | null;
}
