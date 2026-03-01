import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { AuthCurrentUser } from '../services/auth-context.service';

export const CurrentUser = createParamDecorator(
   (_data: unknown, context: ExecutionContext): AuthCurrentUser | undefined => {
      const gqlCtx = GqlExecutionContext.create(context).getContext();
      return gqlCtx?.user as AuthCurrentUser | undefined;
   },
);
