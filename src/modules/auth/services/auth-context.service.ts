import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { ConfigType } from '@nestjs/config';
import {
   AuthChannelEnum as PrismaAuthChannelEnum,
   RoleEnum,
} from '../../../../.prisma/client';
import authConfig from '../auth.config';
import { AUTH_COOKIE } from '../auth.constants';
import { AuthSessionStateService } from './shared/auth-session-state.service';

export type AuthCurrentUser = {
   id: string;
   role: RoleEnum;
   sessionId?: string;
   channel?: PrismaAuthChannelEnum;
   selectedSchoolId?: string;
};

export type OAuthAccessContext = {
   scopes?: string[];
   clientId?: string;
};

export type RequestMeta = {
   ip?: string;
   userAgent?: string;
};

export type AuthContextTokenPayload = {
   scope: string;
   userId: string;
   channel: PrismaAuthChannelEnum;
   inviteId?: string;
   email?: string;
   deviceId?: string;
   deviceName?: string;
};

type AuthTokenPayload = {
   sub: string;
   role: RoleEnum;
   sid: string;
   ch: PrismaAuthChannelEnum;
   sch?: string;
};

@Injectable()
export class AuthContextService {
   constructor(
      private readonly jwtService: JwtService,
      private readonly sessionStateService: AuthSessionStateService,
      @Inject(authConfig.KEY)
      private readonly config: ConfigType<typeof authConfig>,
   ) {}

   decodeAccessToken(token?: string): AuthCurrentUser | undefined {
      if (!token) return undefined;
      try {
         const payload = this.jwtService.verify<AuthTokenPayload>(token, {
            secret: this.config.jwt.accessSecret,
         });

         if (!payload?.sub || !payload?.role || !payload?.sid || !payload?.ch)
            return undefined;

         return {
            id: payload.sub,
            role: payload.role as RoleEnum,
            sessionId: payload.sid,
            channel: payload.ch as PrismaAuthChannelEnum,
            selectedSchoolId:
               typeof payload.sch === 'string' ? payload.sch : undefined,
         };
      } catch {
         return undefined;
      }
   }

   async resolveAuthenticatedUserFromToken(
      token?: string,
   ): Promise<AuthCurrentUser | undefined> {
      const user = this.decodeAccessToken(token);
      const isActive = await this.isSessionActive(user);
      if (!isActive) return undefined;
      return user;
   }

   async isSessionActive(user?: AuthCurrentUser): Promise<boolean> {
      if (!user?.id || !user.sessionId || !user.channel) return false;
      return this.sessionStateService.isSessionActive({
         sessionId: user.sessionId,
         userId: user.id,
         channel: user.channel,
      });
   }

   decodeContextToken(token?: string): AuthContextTokenPayload | undefined {
      if (!token) return undefined;
      try {
         const payload = this.jwtService.verify<AuthContextTokenPayload>(
            token,
            {
               secret: this.config.jwt.contextSecret,
            },
         );
         if (!payload?.userId || !payload?.scope || !payload?.channel)
            return undefined;
         return payload;
      } catch {
         return undefined;
      }
   }

   resolveUserFromRequest(req?: Request): AuthCurrentUser | undefined {
      if (!req) return undefined;
      const token = this.extractAccessTokenFromRequest(req);
      return this.decodeAccessToken(token);
   }

   async resolveAuthenticatedUserFromRequest(
      req?: Request,
   ): Promise<AuthCurrentUser | undefined> {
      if (!req) return undefined;
      const token = this.extractAccessTokenFromRequest(req);
      return this.resolveAuthenticatedUserFromToken(token);
   }

   extractAccessTokenFromRequest(req?: Request): string | undefined {
      const authHeader = req?.headers?.authorization;
      if (authHeader?.startsWith('Bearer ')) {
         return authHeader.slice(7);
      }

      const cookieToken = req?.cookies?.[AUTH_COOKIE.ACCESS];
      return typeof cookieToken === 'string' ? cookieToken : undefined;
   }

   extractRefreshTokenFromRequest(req?: Request): string | undefined {
      const cookieToken = req?.cookies?.[AUTH_COOKIE.REFRESH];
      return typeof cookieToken === 'string' ? cookieToken : undefined;
   }

   extractBearerToken(value?: string): string | undefined {
      if (!value) return undefined;
      return value.startsWith('Bearer ') ? value.slice(7) : value;
   }
}
