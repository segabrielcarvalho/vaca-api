import {
   CanActivate,
   ExecutionContext,
   Injectable,
   UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AUTH_COOKIE } from '../auth.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthContextService } from '../services/auth-context.service';
import type { AuthCurrentUser } from '../services/auth-context.service';
import { ValidateCsrfTokenService } from '../services/shared/validate-csrf-token.service';

@Injectable()
export class GqlAuthGuard implements CanActivate {
   constructor(
      private readonly reflector: Reflector,
      private readonly authContextService: AuthContextService,
      private readonly validateCsrfTokenService: ValidateCsrfTokenService,
   ) {}

   async canActivate(context: ExecutionContext): Promise<boolean> {
      const isPublic = this.reflector.getAllAndOverride<boolean>(
         IS_PUBLIC_KEY,
         [context.getHandler(), context.getClass()],
      );

      if (isPublic) return true;

      if (context.getType<'http' | 'graphql'>() === 'http') {
         const req = context.switchToHttp().getRequest<Request>();
         const user =
            await this.authContextService.resolveAuthenticatedUserFromRequest(
               req,
            );
         if (!user?.id) throw new UnauthorizedException('Nao autenticado');
         req.user = user;
         return true;
      }

      const gqlExecutionContext = GqlExecutionContext.create(context);
      const gqlCtx = gqlExecutionContext.getContext();
      const operation = gqlExecutionContext.getInfo()?.operation?.operation;
      const req = gqlCtx?.req as Request | undefined;
      const authHeader = req?.headers?.authorization;
      const usingBearerToken =
         typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
      const usingCookieAuth =
         typeof req?.cookies?.[AUTH_COOKIE.ACCESS] === 'string' &&
         !usingBearerToken;
      const existingUser = gqlCtx?.user as AuthCurrentUser | undefined;
      if (existingUser?.id && existingUser.sessionId && existingUser.channel) {
         const isActive =
            await this.authContextService.isSessionActive(existingUser);
         if (isActive) {
            if (operation === 'mutation') {
               this.validateCsrfTokenService.run({
                  req,
                  channel: existingUser.channel,
                  usingCookieAuth,
               });
            }
            if (req) req.user = existingUser;
            gqlCtx.user = existingUser;
            return true;
         }
      }

      const user =
         await this.authContextService.resolveAuthenticatedUserFromRequest(req);
      if (!user?.id) {
         throw new UnauthorizedException('Nao autenticado');
      }

      if (operation === 'mutation') {
         this.validateCsrfTokenService.run({
            req,
            channel: user.channel,
            usingCookieAuth,
         });
      }

      if (req) req.user = user;
      gqlCtx.user = user;
      return true;
   }
}
