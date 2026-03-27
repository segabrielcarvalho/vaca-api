import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CorrectionCaptureReviewAuditLogObject {
   @Field()
   id!: string;

   @Field(() => Date)
   createdAt!: Date;

   @Field()
   action!: string;

   @Field({ nullable: true })
   actorId?: string | null;

   @Field({ nullable: true })
   actorName?: string | null;
}
