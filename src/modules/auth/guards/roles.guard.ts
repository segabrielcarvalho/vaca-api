import {
   CanActivate,
   ExecutionContext,
   ForbiddenException,
   Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RoleEnum } from '../../../../.prisma/client';
import { ROLES_KEY } from '../decorators/authorized.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type RequestUser = {
   role?: RoleEnum;
};

type RequestLike = {
   user?: RequestUser;
   req?: { user?: RequestUser };
};

@Injectable()
export class RolesGuard implements CanActivate {
   constructor(private readonly reflector: Reflector) {}

   canActivate(context: ExecutionContext): boolean {
      const isPublic = this.reflector.getAllAndOverride<boolean>(
         IS_PUBLIC_KEY,
         [context.getHandler(), context.getClass()],
      );
      if (isPublic) return true;

      const requiredRoles = this.reflector.getAllAndOverride<RoleEnum[]>(
         ROLES_KEY,
         [context.getHandler(), context.getClass()],
      );

      if (!requiredRoles || requiredRoles.length === 0) {
         return true;
      }

      const request = this.getRequest(context);
      const user = request?.user ?? request?.req?.user;

      if (user?.role && requiredRoles.includes(user.role)) {
         return true;
      }

      throw new ForbiddenException('Acesso negado');
   }

   private getRequest(context: ExecutionContext): RequestLike | undefined {
      if (context.getType<'http' | 'graphql'>() === 'http') {
         return context.switchToHttp().getRequest<RequestLike>();
      }

      const gqlContext = GqlExecutionContext.create(context).getContext();
      return gqlContext as RequestLike | undefined;
   }
}
