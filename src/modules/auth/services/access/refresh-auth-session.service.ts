import {
   AuthAuditEventTypeEnum,
   AuthChannelEnum as PrismaAuthChannelEnum,
   Prisma,
} from '../../../../../.prisma/client';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { createTokenHash } from '../../utils/auth-crypto.util';
import type { RefreshAuthSessionInput } from '../../input';
import type { AuthSessionResult } from '../../objects';
import type { RequestMeta } from '../auth-context.service';
import { AuthAuditService } from '../shared/auth-audit.service';
import { AuthSessionService } from '../shared/auth-session.service';
import { AuthSessionStateService } from '../shared/auth-session-state.service';

@Injectable()
export class RefreshAuthSessionService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly sessionService: AuthSessionService,
      private readonly auditService: AuthAuditService,
      private readonly sessionStateService: AuthSessionStateService,
   ) {}

   async run(
      input: RefreshAuthSessionInput,
      refreshTokenFromCookie?: string,
      meta?: RequestMeta,
   ): Promise<AuthSessionResult> {
      const refreshToken = input.refreshToken ?? refreshTokenFromCookie;
      if (!refreshToken) {
         throw new UnauthorizedException('Refresh token ausente.');
      }

      const refreshTokenHash = createTokenHash(refreshToken);
      const now = new Date();

      const previous = await this.prisma.authSession.findFirst({
         where: {
            refreshTokenHash,
            channel: input.channel as PrismaAuthChannelEnum,
            revokedAt: null,
            expiresAt: { gt: now },
         },
      });

      if (!previous) {
         throw new UnauthorizedException('Sessao invalida.');
      }

      const previousUser = await this.prisma.user.findUnique({
         where: { id: previous.userId },
      });

      if (!previousUser) {
         throw new UnauthorizedException('Sessao invalida.');
      }

      await this.prisma.authSession.update({
         where: { id: previous.id },
         data: { revokedAt: now },
      });
      await this.sessionStateService.markSessionRevoked({
         sessionId: previous.id,
         userId: previous.userId,
         channel: previous.channel,
         expiresAt: previous.expiresAt,
      });

      const issued = await this.sessionService.run({
         userId: previous.userId,
         role: previousUser.role,
         channel: input.channel as PrismaAuthChannelEnum,
         authDeviceId: previous.authDeviceId ?? undefined,
         selectedSchoolId: previous.selectedSchoolId ?? undefined,
         meta,
         rotatedFromSessionId: previous.id,
      });

      await this.auditService.run({
         userId: previous.userId,
         eventType: AuthAuditEventTypeEnum.session_refreshed,
         channel: input.channel as PrismaAuthChannelEnum,
         metadata: {
            previousSessionId: previous.id,
            sessionId: issued.session.sessionId,
         } as Prisma.InputJsonValue,
      });

      return issued.session;
   }
}
