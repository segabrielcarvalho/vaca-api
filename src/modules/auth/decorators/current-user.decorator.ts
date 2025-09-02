import {
   createParamDecorator,
   ExecutionContext,
   InternalServerErrorException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator(
   (data: unknown, context: ExecutionContext) => {
      const ctx = GqlExecutionContext.create(context);
      const user = ctx.getContext().req.user;
      if (!user) {
         throw new InternalServerErrorException(
            'User not found in request context',
         );
      }
      if (typeof data === 'string' && !user[data]) {
         throw new InternalServerErrorException(
            `User property "${data}" not found in request context`,
         );
      }
      return data ? user?.[data as string] : user;
   },
);
