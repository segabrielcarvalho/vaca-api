import {
   AuthAuditEventTypeEnum,
   AuthChannelEnum as PrismaAuthChannelEnum,
   Prisma,
   RoleEnum as PrismaRoleEnum,
} from '../../../../../.prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthChannelEnum } from '../../../graphql/@generated/prisma/auth-channel.enum';
import { PrismaService } from '../../../prisma/prisma.service';
import authConfig from '../../auth.config';
import type { AuthSessionResult } from '../../objects';
import type { RequestMeta } from '../auth-context.service';
import {
   createTokenHash,
   generateRandomToken,
} from '../../utils/auth-crypto.util';
import { AuthAuditService } from './auth-audit.service';
import { AuthSessionStateService } from './auth-session-state.service';

export type SessionIssueResult = {
   session: AuthSessionResult;
   accessToken: string;
   refreshToken: string;
};

@Injectable()
export class AuthSessionService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly jwtService: JwtService,
      private readonly auditService: AuthAuditService,
      private readonly sessionStateService: AuthSessionStateService,
      @Inject(authConfig.KEY)
      private readonly config: ConfigType<typeof authConfig>,
   ) {}

   async run(input: {
      userId: string;
      role: PrismaRoleEnum;
      channel: PrismaAuthChannelEnum;
      authDeviceId?: string;
      selectedSchoolId?: string;
      meta?: RequestMeta;
      rotatedFromSessionId?: string;
   }): Promise<SessionIssueResult> {
      const accessTokenExpiresAt = new Date(
         Date.now() + this.config.jwt.accessTtlSec * 1000,
      );
      const refreshTokenExpiresAt = new Date(
         Date.now() + this.config.refresh.ttlSec * 1000,
      );
      const refreshTokenRaw = generateRandomToken(48);
      const refreshTokenHash = createTokenHash(refreshTokenRaw);
      const now = new Date();

      const activeSessions = await this.prisma.authSession.findMany({
         where: {
            userId: input.userId,
            channel: input.channel,
            revokedAt: null,
            expiresAt: { gt: now },
         },
      });

      if (activeSessions.length > 0) {
         await this.prisma.authSession.updateMany({
            where: { id: { in: activeSessions.map((item) => item.id) } },
            data: { revokedAt: now },
         });

         await Promise.all(
            activeSessions.map(async (existingSession) => {
               await this.sessionStateService.markSessionRevoked({
                  sessionId: existingSession.id,
                  userId: input.userId,
                  channel: input.channel,
                  expiresAt: existingSession.expiresAt,
               });
               await this.auditService.run({
                  userId: input.userId,
                  eventType: AuthAuditEventTypeEnum.session_revoked,
                  channel: input.channel,
                  metadata: {
                     revokedSessionId: existingSession.id,
                     reason: 'single_session_per_channel',
                  } as Prisma.InputJsonValue,
               });
            }),
         );
      }

      const session = await this.prisma.authSession.create({
         data: {
            userId: input.userId,
            channel: input.channel,
            refreshTokenHash,
            expiresAt: refreshTokenExpiresAt,
            authDeviceId: input.authDeviceId,
            selectedSchoolId: input.selectedSchoolId,
            ip: input.meta?.ip,
            userAgent: input.meta?.userAgent,
            rotatedFromSessionId: input.rotatedFromSessionId,
         },
      });

      const accessToken = this.jwtService.sign(
         {
            sub: input.userId,
            role: input.role,
            sid: session.id,
            ch: input.channel,
            sch: session.selectedSchoolId ?? undefined,
         },
         {
            secret: this.config.jwt.accessSecret,
            expiresIn: this.config.jwt.accessTtlSec,
         },
      );

      const csrfToken = generateRandomToken(24);

      const sessionResult: AuthSessionResult = {
         sessionId: session.id,
         channel: input.channel as unknown as AuthChannelEnum,
         accessToken,
         refreshToken: refreshTokenRaw,
         csrfToken,
         requiresCookieWrite: input.channel === PrismaAuthChannelEnum.web_admin,
         selectedSchoolId: session.selectedSchoolId ?? undefined,
         accessTokenExpiresAt,
         refreshTokenExpiresAt,
      };

      await this.prisma.user.update({
         where: { id: input.userId },
         data: { lastSession: new Date() },
      });

      await this.sessionStateService.cacheSessionFromEntity(session);

      await this.auditService.run({
         userId: input.userId,
         eventType: AuthAuditEventTypeEnum.session_created,
         channel: input.channel,
         metadata: {
            sessionId: session.id,
            authDeviceId: input.authDeviceId ?? null,
            selectedSchoolId: session.selectedSchoolId ?? null,
         } as Prisma.InputJsonValue,
      });

      return {
         session: sessionResult,
         accessToken,
         refreshToken: refreshTokenRaw,
      };
   }
}
