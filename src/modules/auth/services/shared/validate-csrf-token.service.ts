import { AuthChannelEnum as PrismaAuthChannelEnum } from '../../../../../.prisma/client';
import { UnauthorizedException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { AUTH_COOKIE } from '../../auth.constants';
import { AuthChannelEnum as GraphQLAuthChannelEnum } from '../../../graphql/@generated/prisma/auth-channel.enum';

@Injectable()
export class ValidateCsrfTokenService {
   run(input: {
      req?: Request;
      channel?: PrismaAuthChannelEnum | GraphQLAuthChannelEnum;
      usingCookieAuth: boolean;
   }) {
      if (input.channel !== PrismaAuthChannelEnum.web_admin) return;
      if (!input.usingCookieAuth) return;

      const cookieToken = input.req?.cookies?.[AUTH_COOKIE.CSRF];
      const headerTokenRaw = input.req?.headers['x-csrf-token'];
      const headerToken = Array.isArray(headerTokenRaw)
         ? headerTokenRaw[0]
         : headerTokenRaw;

      if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') {
         throw new UnauthorizedException('CSRF token ausente.');
      }

      const cookieBuffer = Buffer.from(cookieToken);
      const headerBuffer = Buffer.from(headerToken);
      if (
         cookieBuffer.length !== headerBuffer.length ||
         !timingSafeEqual(cookieBuffer, headerBuffer)
      ) {
         throw new UnauthorizedException('CSRF token invalido.');
      }
   }
}
