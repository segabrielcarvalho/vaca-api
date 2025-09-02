import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RoleEnum } from '@prisma/client';
import { ROLES_KEY } from '../decorators/authorized.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
   constructor(private reflector: Reflector) {}

   canActivate(context: ExecutionContext): boolean {
      const ctx = GqlExecutionContext.create(context);

      const isPublic = this.reflector.getAllAndOverride<boolean>(
         IS_PUBLIC_KEY,
         [ctx.getHandler(), ctx.getClass()],
      );
      if (isPublic) return true;

      const requiredRoles = this.reflector.getAllAndOverride<RoleEnum[]>(
         ROLES_KEY,
         [ctx.getHandler(), ctx.getClass()],
      );

      if (!requiredRoles || requiredRoles.length === 0) return true;
      const { user } = ctx.getContext().req;
      if (!user || !user.role) return false;
      const userRole = user.role;
      return requiredRoles.some((role) => userRole.includes(role));
   }
}
