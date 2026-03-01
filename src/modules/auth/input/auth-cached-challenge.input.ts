import {
   AuthChallengeTypeEnum,
   AuthChannelEnum,
} from '../../../../.prisma/client';

export class AuthCachedChallengeInput {
   id!: string;
   type!: AuthChallengeTypeEnum;
   channel!: AuthChannelEnum;
   email!: string | null;
   userId!: string | null;
   inviteId!: string | null;
   codeHash!: string | null;
   tokenHash!: string | null;
   payload!: Record<string, unknown> | null;
   attempts!: number;
   maxAttempts!: number;
   createdAt!: Date;
   expiresAt!: Date;
   consumedAt!: Date | null;
}
