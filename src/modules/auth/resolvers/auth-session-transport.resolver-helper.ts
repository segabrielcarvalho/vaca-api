import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Request, Response } from 'express';
import authConfig from '../auth.config';
import { AUTH_COOKIE } from '../auth.constants';
import { AuthChannelEnum } from '../../graphql/@generated/prisma/auth-channel.enum';
import type { AuthSessionResult } from '../objects';
import type { RequestMeta } from '../services/auth-context.service';

@Injectable()
export class AuthSessionTransportResolverHelper {
   constructor(
      @Inject(authConfig.KEY)
      private readonly config: ConfigType<typeof authConfig>,
   ) {}

   extractMeta(req?: Request): RequestMeta {
      return {
         ip: req?.ip,
         userAgent: req?.headers['user-agent'],
      };
   }

   applySessionTransport(
      session: AuthSessionResult,
      res?: Response,
   ): AuthSessionResult {
      if (!res) return session;

      if (
         session.channel === AuthChannelEnum.web_admin &&
         session.requiresCookieWrite
      ) {
         const cookieCommon = {
            httpOnly: true,
            secure: this.config.cookie.secure,
            sameSite: this.config.cookie.sameSite as 'lax' | 'strict' | 'none',
            domain: this.config.cookie.domain,
            path: '/',
         };

         if (session.accessToken) {
            res.cookie(AUTH_COOKIE.ACCESS, session.accessToken, {
               ...cookieCommon,
               maxAge: this.config.jwt.accessTtlSec * 1000,
            });
         }

         if (session.refreshToken) {
            res.cookie(AUTH_COOKIE.REFRESH, session.refreshToken, {
               ...cookieCommon,
               maxAge: this.config.refresh.ttlSec * 1000,
            });
         }

         if (session.csrfToken) {
            res.cookie(AUTH_COOKIE.CSRF, session.csrfToken, {
               ...cookieCommon,
               httpOnly: false,
               maxAge: this.config.csrf.ttlSec * 1000,
            });
         }

         return {
            ...session,
            accessToken: undefined,
            refreshToken: undefined,
         };
      }

      return session;
   }

   clearAuthCookies(res?: Response) {
      if (!res) return;
      const baseOptions = {
         domain: this.config.cookie.domain,
         path: '/',
      };
      res.clearCookie(AUTH_COOKIE.ACCESS, baseOptions);
      res.clearCookie(AUTH_COOKIE.REFRESH, baseOptions);
      res.clearCookie(AUTH_COOKIE.CSRF, baseOptions);
   }
}
