import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { AUTH_COOKIE } from '../auth.constants';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import {
   ActionResultObject,
   AuthSessionResult,
   EmailChallengeStart,
} from '../objects';
import { AuthChannelEnum } from '../../graphql/@generated/prisma/auth-channel.enum';
import {
   ConsumeEmailLoginMagicLinkArgs,
   LogoutCurrentSessionArgs,
   RefreshAuthSessionArgs,
   StartEmailLoginArgs,
   VerifyEmailLoginCodeArgs,
} from '../args';
import { ConsumeEmailLoginMagicLinkService } from '../services/access/consume-email-login-magic-link.service';
import { LogoutCurrentSessionService } from '../services/access/logout-current-session.service';
import { RefreshAuthSessionService } from '../services/access/refresh-auth-session.service';
import { StartEmailLoginService } from '../services/access/start-email-login.service';
import { VerifyEmailLoginCodeService } from '../services/access/verify-email-login-code.service';
import { ValidateCsrfTokenService } from '../services/shared/validate-csrf-token.service';
import { AuthSessionTransportResolverHelper } from './auth-session-transport.resolver-helper';
import type { AuthCurrentUser } from '../services/auth-context.service';

@Resolver()
export class AuthAccessResolver {
   constructor(
      private readonly startEmailLoginService: StartEmailLoginService,
      private readonly verifyEmailLoginCodeService: VerifyEmailLoginCodeService,
      private readonly consumeEmailLoginMagicLinkService: ConsumeEmailLoginMagicLinkService,
      private readonly refreshAuthSessionService: RefreshAuthSessionService,
      private readonly logoutCurrentSessionService: LogoutCurrentSessionService,
      private readonly validateCsrfTokenService: ValidateCsrfTokenService,
      private readonly transport: AuthSessionTransportResolverHelper,
   ) {}

   @Public()
   @Mutation(() => EmailChallengeStart)
   async startEmailLogin(
      @Args() args: StartEmailLoginArgs,
      @Context() ctx: { req?: Request },
   ): Promise<EmailChallengeStart> {
      return this.startEmailLoginService.run(
         args.data,
         this.transport.extractMeta(ctx.req),
      );
   }

   @Public()
   @Mutation(() => AuthSessionResult)
   async verifyEmailLoginCode(
      @Args() args: VerifyEmailLoginCodeArgs,
      @Context() ctx: { req?: Request; res?: Response },
   ): Promise<AuthSessionResult> {
      const result = await this.verifyEmailLoginCodeService.run(
         args.data,
         this.transport.extractMeta(ctx.req),
      );
      return this.transport.applySessionTransport(result, ctx.res);
   }

   @Public()
   @Mutation(() => AuthSessionResult)
   async consumeEmailLoginMagicLink(
      @Args() args: ConsumeEmailLoginMagicLinkArgs,
      @Context() ctx: { req?: Request; res?: Response },
   ): Promise<AuthSessionResult> {
      const result = await this.consumeEmailLoginMagicLinkService.run(
         args.data,
         this.transport.extractMeta(ctx.req),
      );
      return this.transport.applySessionTransport(result, ctx.res);
   }

   @Public()
   @Mutation(() => AuthSessionResult)
   async refreshAuthSession(
      @Args() args: RefreshAuthSessionArgs,
      @Context() ctx: { req?: Request; res?: Response },
   ): Promise<AuthSessionResult> {
      const refreshTokenFromCookie = ctx.req?.cookies?.[AUTH_COOKIE.REFRESH];
      this.validateCsrfTokenService.run({
         req: ctx.req,
         channel: args.data.channel,
         usingCookieAuth:
            !args.data.refreshToken &&
            typeof refreshTokenFromCookie === 'string',
      });

      const result = await this.refreshAuthSessionService.run(
         args.data,
         refreshTokenFromCookie,
         this.transport.extractMeta(ctx.req),
      );
      return this.transport.applySessionTransport(result, ctx.res);
   }

   @Public()
   @Mutation(() => ActionResultObject)
   async logoutCurrentSession(
      @Args() args: LogoutCurrentSessionArgs,
      @CurrentUser() user: AuthCurrentUser | undefined,
      @Context() ctx: { req?: Request; res?: Response },
   ): Promise<ActionResultObject> {
      const refreshTokenFromCookie = ctx.req?.cookies?.[AUTH_COOKIE.REFRESH];
      const authHeader = ctx.req?.headers?.authorization;
      const usingBearerToken =
         typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
      this.validateCsrfTokenService.run({
         req: ctx.req,
         channel: args.data.channel,
         usingCookieAuth:
            !args.data.refreshToken &&
            (typeof refreshTokenFromCookie === 'string' ||
               (typeof ctx.req?.cookies?.[AUTH_COOKIE.ACCESS] === 'string' &&
                  !usingBearerToken)),
      });

      const result = await this.logoutCurrentSessionService.run(
         user,
         args.data.channel,
         args.data.refreshToken,
         refreshTokenFromCookie,
      );

      if (args.data.channel === AuthChannelEnum.web_admin) {
         this.transport.clearAuthCookies(ctx.res);
      }

      return result;
   }
}
