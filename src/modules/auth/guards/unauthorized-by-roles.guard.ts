import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RoleEnum } from '@prisma/client';
import { ROLES_KEY } from '../decorators/unauthorized.decorator';

@Injectable()
export class UnauthorizedByRolesGuard implements CanActivate {
   constructor(private reflector: Reflector) {}

   canActivate(context: ExecutionContext): boolean {
      const ctx = GqlExecutionContext.create(context);
      const roles = this.reflector.getAllAndOverride<RoleEnum[]>(ROLES_KEY, [
         ctx.getHandler(),
         ctx.getClass(),
      ]);
      if (!roles || roles.length == 0) {
         return false;
      }
      const { user } = ctx.getContext().req;
      const userRole = user?.role;
      return !roles.some((role) => userRole.includes(role));
   }
}
