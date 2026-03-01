import {
   AuthAuditEventTypeEnum,
   AuthChannelEnum as PrismaAuthChannelEnum,
   Prisma,
} from '../../../../../.prisma/client';
import { Injectable } from '@nestjs/common';
import type { AuthChannelEnum } from '../../../graphql/@generated/prisma/auth-channel.enum';
import { PrismaService } from '../../../prisma/prisma.service';
import { createTokenHash } from '../../utils/auth-crypto.util';
import type { ActionResultObject } from '../../objects';
import type { AuthCurrentUser } from '../auth-context.service';
import { AuthAuditService } from '../shared/auth-audit.service';
import { AuthSessionStateService } from '../shared/auth-session-state.service';

@Injectable()
export class LogoutCurrentSessionService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly auditService: AuthAuditService,
      private readonly sessionStateService: AuthSessionStateService,
   ) {}

   async run(
      user: AuthCurrentUser | undefined,
      channel: AuthChannelEnum,
      refreshToken?: string,
      refreshTokenFromCookie?: string,
   ): Promise<ActionResultObject> {
      const token = refreshToken ?? refreshTokenFromCookie;

      if (token) {
         const session = await this.prisma.authSession.findFirst({
            where: {
               refreshTokenHash: createTokenHash(token),
               channel: channel as PrismaAuthChannelEnum,
               revokedAt: null,
            },
         });

         if (session) {
            await this.prisma.authSession.update({
               where: { id: session.id },
               data: { revokedAt: new Date() },
            });
            await this.sessionStateService.markSessionRevoked({
               sessionId: session.id,
               userId: session.userId,
               channel: session.channel,
               expiresAt: session.expiresAt,
            });

            await this.auditService.run({
               userId: session.userId,
               eventType: AuthAuditEventTypeEnum.logout,
               channel: channel as PrismaAuthChannelEnum,
               metadata: { sessionId: session.id } as Prisma.InputJsonValue,
            });
         }
      } else if (user?.sessionId) {
         await this.prisma.authSession.updateMany({
            where: {
               id: user.sessionId,
               revokedAt: null,
            },
            data: { revokedAt: new Date() },
         });
         await this.sessionStateService.markSessionRevoked({
            sessionId: user.sessionId,
            userId: user.id,
            channel: channel as PrismaAuthChannelEnum,
         });

         await this.auditService.run({
            userId: user.id,
            eventType: AuthAuditEventTypeEnum.logout,
            channel: channel as PrismaAuthChannelEnum,
            metadata: { sessionId: user.sessionId } as Prisma.InputJsonValue,
         });
      }

      return {
         message: 'Sessao encerrada com sucesso.',
         statusCode: 200,
      };
   }
}
