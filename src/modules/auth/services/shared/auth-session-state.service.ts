import {
   AuthChannelEnum as PrismaAuthChannelEnum,
   AuthSession,
} from '../../../../../.prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AuthCachedSessionStateInput } from '../../input/auth-cached-session-state.input';
import { PrismaService } from '../../../prisma/prisma.service';
import authConfig from '../../auth.config';
import { AuthRedisService } from './auth-redis.service';

@Injectable()
export class AuthSessionStateService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly authRedisService: AuthRedisService,
      @Inject(authConfig.KEY)
      private readonly config: ConfigType<typeof authConfig>,
   ) {}

   async cacheSession(input: {
      id: string;
      userId: string;
      channel: PrismaAuthChannelEnum;
      expiresAt: Date;
      revokedAt?: Date | null;
   }) {
      const ttlSec = Math.max(
         1,
         Math.ceil((input.expiresAt.getTime() - Date.now()) / 1000),
      );
      const payload = new AuthCachedSessionStateInput();
      payload.userId = input.userId;
      payload.channel = input.channel;
      payload.expiresAt = input.expiresAt;
      payload.revokedAt = input.revokedAt ?? null;

      await this.authRedisService.setJson(
         this.sessionKey(input.id),
         {
            userId: payload.userId,
            channel: payload.channel,
            expiresAt: payload.expiresAt.toISOString(),
            revokedAt: payload.revokedAt
               ? payload.revokedAt.toISOString()
               : null,
         },
         ttlSec,
      );
   }

   async markSessionRevoked(input: {
      sessionId: string;
      userId?: string;
      channel?: PrismaAuthChannelEnum;
      expiresAt?: Date;
   }) {
      const ttlSec = input.expiresAt
         ? Math.max(
              1,
              Math.ceil((input.expiresAt.getTime() - Date.now()) / 1000),
           )
         : this.config.jwt.accessTtlSec;
      const payload = new AuthCachedSessionStateInput();
      payload.userId = input.userId ?? '';
      payload.channel = input.channel ?? PrismaAuthChannelEnum.web_admin;
      payload.expiresAt = new Date(Date.now() + ttlSec * 1000);
      payload.revokedAt = new Date();

      await this.authRedisService.setJson(
         this.sessionKey(input.sessionId),
         {
            userId: payload.userId,
            channel: payload.channel,
            expiresAt: payload.expiresAt.toISOString(),
            revokedAt: payload.revokedAt.toISOString(),
         },
         ttlSec,
      );
   }

   async isSessionActive(input: {
      sessionId: string;
      userId?: string;
      channel?: PrismaAuthChannelEnum;
   }): Promise<boolean> {
      const cached = await this.getCachedSession(input.sessionId);
      if (cached) {
         return this.validateState(cached, input);
      }

      const session = await this.prisma.authSession.findUnique({
         where: { id: input.sessionId },
      });
      if (!session) {
         await this.markSessionRevoked({ sessionId: input.sessionId });
         return false;
      }

      await this.cacheSessionFromEntity(session);
      return this.validateEntity(session, input);
   }

   async cacheSessionFromEntity(session: AuthSession) {
      await this.cacheSession({
         id: session.id,
         userId: session.userId,
         channel: session.channel,
         expiresAt: session.expiresAt,
         revokedAt: session.revokedAt,
      });
   }

   private async getCachedSession(sessionId: string) {
      const raw = await this.authRedisService.getJson<Record<string, unknown>>(
         this.sessionKey(sessionId),
      );
      if (!raw) return null;
      try {
         const value = new AuthCachedSessionStateInput();
         value.userId = String(raw.userId ?? '');
         value.channel = raw.channel as PrismaAuthChannelEnum;
         value.expiresAt = new Date(String(raw.expiresAt));
         value.revokedAt = raw.revokedAt
            ? new Date(String(raw.revokedAt))
            : null;
         return value;
      } catch {
         return null;
      }
   }

   private validateState(
      value: AuthCachedSessionStateInput,
      input: {
         sessionId: string;
         userId?: string;
         channel?: PrismaAuthChannelEnum;
      },
   ) {
      if (value.revokedAt) return false;
      if (value.expiresAt.getTime() <= Date.now()) return false;
      if (input.userId && value.userId && input.userId !== value.userId)
         return false;
      if (input.channel && input.channel !== value.channel) return false;
      return true;
   }

   private validateEntity(
      session: AuthSession,
      input: {
         sessionId: string;
         userId?: string;
         channel?: PrismaAuthChannelEnum;
      },
   ) {
      if (session.revokedAt) return false;
      if (session.expiresAt.getTime() <= Date.now()) return false;
      if (input.userId && input.userId !== session.userId) return false;
      if (input.channel && input.channel !== session.channel) return false;
      return true;
   }

   private sessionKey(sessionId: string) {
      return `auth:session:${sessionId}`;
   }
}
