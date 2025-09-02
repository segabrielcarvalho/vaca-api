import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt-graphql', 'jwt-graphql-ws']) {
   constructor(private reflector: Reflector) {
      super();
   }

   getRequest(contextExecution: ExecutionContext) {
      const gqlContextExecution = GqlExecutionContext.create(contextExecution);
      const context = gqlContextExecution.getContext();
      return context.req || context;
   }

   canActivate(
      context: ExecutionContext,
   ): boolean | Promise<boolean> | Observable<boolean> {
      const isPublic = this.reflector.getAllAndOverride<boolean>(
         IS_PUBLIC_KEY,
         [context.getHandler(), context.getClass()],
      );
      if (isPublic) return true;

      return super.canActivate(context);
   }
}
