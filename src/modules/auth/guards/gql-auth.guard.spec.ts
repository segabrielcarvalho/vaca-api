import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthChannelEnum, RoleEnum } from '../../../../.prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthContextService } from '../services/auth-context.service';
import { ValidateCsrfTokenService } from '../services/shared/validate-csrf-token.service';
import { GqlAuthGuard } from './gql-auth.guard';

jest.mock('@nestjs/graphql', () => ({
   GqlExecutionContext: {
      create: jest.fn(),
   },
}));

describe('GqlAuthGuard', () => {
   let guard: GqlAuthGuard;
   let reflector: { getAllAndOverride: jest.Mock };
   let authContextService: {
      resolveAuthenticatedUserFromRequest: jest.Mock;
      isSessionActive: jest.Mock;
   };
   let validateCsrfTokenService: { run: jest.Mock };
   let gqlCreateMock: jest.Mock;

   beforeEach(() => {
      reflector = {
         getAllAndOverride: jest.fn(),
      };
      authContextService = {
         resolveAuthenticatedUserFromRequest: jest.fn(),
         isSessionActive: jest.fn(),
      };
      validateCsrfTokenService = {
         run: jest.fn(),
      };

      guard = new GqlAuthGuard(
         reflector as unknown as Reflector,
         authContextService as unknown as AuthContextService,
         validateCsrfTokenService as unknown as ValidateCsrfTokenService,
      );

      gqlCreateMock = GqlExecutionContext.create as unknown as jest.Mock;
      gqlCreateMock.mockReset();
   });

   it('deve autenticar requisicao graphql http usando req', async () => {
      const user = {
         id: 'user-1',
         role: RoleEnum.admin,
         sessionId: 'session-1',
         channel: AuthChannelEnum.web_admin,
      };
      const req = {
         headers: {
            authorization: 'Bearer token',
         },
      };

      reflector.getAllAndOverride.mockImplementation((key: string) => {
         if (key === IS_PUBLIC_KEY) return false;
         return undefined;
      });
      authContextService.resolveAuthenticatedUserFromRequest.mockResolvedValue(
         user,
      );
      gqlCreateMock.mockReturnValue({
         getContext: () => ({ req }),
         getInfo: () => ({ operation: { operation: 'query' } }),
      });

      await expect(guard.canActivate(createGraphqlContext())).resolves.toBe(
         true,
      );
      expect(
         authContextService.resolveAuthenticatedUserFromRequest,
      ).toHaveBeenCalledWith(req);
      expect(req).toMatchObject({ user });
   });

   it('deve permitir subscription autenticada com user no contexto sem req.headers', async () => {
      const user = {
         id: 'user-1',
         role: RoleEnum.admin,
         sessionId: 'session-1',
         channel: AuthChannelEnum.expo_mobile,
      };
      const gqlCtx = {
         user,
         req: {
            cookies: {},
         },
      };

      reflector.getAllAndOverride.mockImplementation((key: string) => {
         if (key === IS_PUBLIC_KEY) return false;
         return undefined;
      });
      authContextService.isSessionActive.mockResolvedValue(true);
      gqlCreateMock.mockReturnValue({
         getContext: () => gqlCtx,
         getInfo: () => ({ operation: { operation: 'subscription' } }),
      });

      await expect(guard.canActivate(createGraphqlContext())).resolves.toBe(
         true,
      );
      expect(authContextService.isSessionActive).toHaveBeenCalledWith(user);
      expect(
         authContextService.resolveAuthenticatedUserFromRequest,
      ).not.toHaveBeenCalled();
      expect(validateCsrfTokenService.run).not.toHaveBeenCalled();
   });

   it('deve negar subscription sem usuario autenticado', async () => {
      reflector.getAllAndOverride.mockImplementation((key: string) => {
         if (key === IS_PUBLIC_KEY) return false;
         return undefined;
      });
      authContextService.resolveAuthenticatedUserFromRequest.mockResolvedValue(
         undefined,
      );
      gqlCreateMock.mockReturnValue({
         getContext: () => ({}),
         getInfo: () => ({ operation: { operation: 'subscription' } }),
      });

      await expect(guard.canActivate(createGraphqlContext())).rejects.toThrow(
         UnauthorizedException,
      );
   });
});

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
