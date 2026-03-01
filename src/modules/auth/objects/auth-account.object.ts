import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { AuthChannelEnum } from '../../graphql/@generated/prisma/auth-channel.enum';
import { User } from '../../graphql/@generated/user/user.model';

@ObjectType()
export class AuthMe extends User {
   @Field({ nullable: true })
   photoUrl?: string;
}

@ObjectType()
export class AuthSessionInfo {
   @Field(() => ID)
   id!: string;

   @Field(() => AuthChannelEnum)
   channel!: AuthChannelEnum;

   @Field(() => GraphQLISODateTime)
   createdAt!: Date;

   @Field(() => GraphQLISODateTime)
   expiresAt!: Date;

   @Field(() => GraphQLISODateTime, { nullable: true })
   revokedAt?: Date | null;

   @Field({ nullable: true })
   deviceId?: string;

   @Field({ nullable: true })
   deviceName?: string;

   @Field(() => GraphQLISODateTime, { nullable: true })
   lastSeenAt?: Date | null;

   @Field({ nullable: true })
   ip?: string;

   @Field({ nullable: true })
   userAgent?: string;
}
