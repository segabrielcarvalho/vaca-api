import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { AuthChannelEnum } from '../../graphql/@generated/prisma/auth-channel.enum';

@ObjectType()
export class AuthSessionResult {
   @Field(() => ID)
   sessionId!: string;

   @Field(() => AuthChannelEnum)
   channel!: AuthChannelEnum;

   @Field({ nullable: true })
   accessToken?: string;

   @Field({ nullable: true })
   refreshToken?: string;

   @Field({ nullable: true })
   csrfToken?: string;

   @Field()
   requiresCookieWrite!: boolean;

   @Field(() => ID, { nullable: true })
   selectedSchoolId?: string;

   @Field(() => GraphQLISODateTime)
   accessTokenExpiresAt!: Date;

   @Field(() => GraphQLISODateTime)
   refreshTokenExpiresAt!: Date;
}

@ObjectType()
export class EmailChallengeStart {
   @Field(() => ID)
   challengeId!: string;

   @Field()
   maskedEmail!: string;

   @Field(() => GraphQLISODateTime)
   expiresAt!: Date;
}
