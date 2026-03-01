import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RoleEnum } from '../../../../.prisma/client';
import { ROLES_KEY } from '../decorators/authorized.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RolesGuard } from './roles.guard';

jest.mock('@nestjs/graphql', () => ({
   GqlExecutionContext: {
      create: jest.fn(),
   },
}));

type RequestUser = {
   role?: RoleEnum;
};

type RequestLike = {
   user?: RequestUser;
   req?: { user?: RequestUser };
};

describe('RolesGuard', () => {
   let guard: RolesGuard;
   let reflector: { getAllAndOverride: jest.Mock };
   let gqlCreateMock: jest.Mock;

   beforeEach(() => {
      reflector = {
         getAllAndOverride: jest.fn(),
      };
      guard = new RolesGuard(reflector as unknown as Reflector);
      gqlCreateMock = GqlExecutionContext.create as unknown as jest.Mock;
      gqlCreateMock.mockReset();
   });

   it('deve permitir rota publica', () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
         if (key === IS_PUBLIC_KEY) return true;
         return undefined;
      });

      const context = createHttpContext();

      expect(guard.canActivate(context)).toBe(true);
   });

   it('deve permitir quando nao ha roles declaradas', () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
         if (key === IS_PUBLIC_KEY) return false;
         if (key === ROLES_KEY) return undefined;
         return undefined;
      });

      const context = createHttpContext();

      expect(guard.canActivate(context)).toBe(true);
   });

   it('deve permitir quando role do usuario esta autorizada no http', () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
         if (key === IS_PUBLIC_KEY) return false;
         if (key === ROLES_KEY) return [RoleEnum.admin];
         return undefined;
      });

      const context = createHttpContext({
         user: { role: RoleEnum.admin },
      });

      expect(guard.canActivate(context)).toBe(true);
   });

   it('deve negar quando role do usuario nao esta autorizada', () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
         if (key === IS_PUBLIC_KEY) return false;
         if (key === ROLES_KEY) return [RoleEnum.admin];
         return undefined;
      });

      const context = createHttpContext({
         user: { role: RoleEnum.user },
      });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
   });

   it('deve ler usuario de ctx.user no graphql', () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
         if (key === IS_PUBLIC_KEY) return false;
         if (key === ROLES_KEY) return [RoleEnum.admin];
         return undefined;
      });

      gqlCreateMock.mockReturnValue({
         getContext: () => ({
            user: { role: RoleEnum.admin },
         }),
      });

      const context = createGraphqlContext();

      expect(guard.canActivate(context)).toBe(true);
   });

   it('deve usar fallback para ctx.req.user no graphql', () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
         if (key === IS_PUBLIC_KEY) return false;
         if (key === ROLES_KEY) return [RoleEnum.admin];
         return undefined;
      });

      gqlCreateMock.mockReturnValue({
         getContext: () => ({
            req: { user: { role: RoleEnum.admin } },
         }),
      });

      const context = createGraphqlContext();

      expect(guard.canActivate(context)).toBe(true);
   });
});

function createHttpContext(request: RequestLike = {}): ExecutionContext {
   return {
      getType: () => 'http',
      getHandler: () => ({}),
      getClass: () => class TestClass {},
      switchToHttp: () => ({
         getRequest: () => request,
      }),
   } as unknown as ExecutionContext;
}

function createGraphqlContext(): ExecutionContext {
   return {
      getType: () => 'graphql',
      getHandler: () => ({}),
      getClass: () => class TestClass {},
      switchToHttp: () => ({
         getRequest: () => ({}),
      }),
   } as unknown as ExecutionContext;
}
