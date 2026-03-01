import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class InviteAcceptanceStart {
   @Field(() => ID)
   challengeId!: string;

   @Field()
   maskedEmail!: string;

   @Field(() => GraphQLISODateTime)
   expiresAt!: Date;
}

@ObjectType()
export class InviteEmailVerified {
   @Field()
   contextId!: string;

   @Field(() => GraphQLISODateTime)
   expiresAt!: Date;
}

@ObjectType()
export class InviteProfileCompleted {
   @Field()
   contextId!: string;

   @Field(() => GraphQLISODateTime)
   profileCompletedAt!: Date;
}
