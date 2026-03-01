import { AuthChannelEnum } from '../../../../.prisma/client';

export class AuthCachedSessionStateInput {
   userId!: string;
   channel!: AuthChannelEnum;
   expiresAt!: Date;
   revokedAt!: Date | null;
}
