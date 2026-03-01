import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AclScopeType, RoleEnum } from '../../../../.prisma/client';
import {
   SCOPED_AUTH_KEY,
   ScopedAuthorizedConfig,
} from '../decorators/scoped-authorized.decorator';
import { ScopedAccessService } from '../services/shared/scoped-access.service';
import { ScopedAccessGuard } from './scoped-access.guard';

jest.mock('@nestjs/graphql', () => ({
   GqlExecutionContext: {
      create: jest.fn(),
   },
}));

describe('ScopedAccessGuard', () => {
   let guard: ScopedAccessGuard;
   let reflector: { getAllAndOverride: jest.Mock };
   let scopedAccessService: { assertPermission: jest.Mock };
   let gqlCreateMock: jest.Mock;

   beforeEach(() => {
      reflector = {
         getAllAndOverride: jest.fn(),
      };
      scopedAccessService = {
         assertPermission: jest.fn(),
      };
      guard = new ScopedAccessGuard(
         reflector as unknown as Reflector,
         scopedAccessService as unknown as ScopedAccessService,
      );
      gqlCreateMock = GqlExecutionContext.create as unknown as jest.Mock;
      gqlCreateMock.mockReset();
   });

   it('deve permitir quando metadata nao existe', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      await expect(guard.canActivate(createGraphqlContext())).resolves.toBe(
         true,
      );
   });

   it('deve validar permissao com escopo fixo', async () => {
      const config: ScopedAuthorizedConfig = {
         permission: 'school.update',
         scopeType: AclScopeType.school,
         scopeIdPath: 'where.id',
      };
      reflector.getAllAndOverride.mockImplementation((key: string) => {
         if (key === SCOPED_AUTH_KEY) return config;
         return undefined;
      });

      gqlCreateMock.mockReturnValue({
         getContext: () => ({ user: { id: 'user-1', role: RoleEnum.user } }),
         getArgs: () => ({ where: { id: 'school-1' } }),
      });

      await expect(guard.canActivate(createGraphqlContext())).resolves.toBe(
         true,
      );
      expect(scopedAccessService.assertPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         permissionCode: 'school.update',
         scopeType: AclScopeType.school,
         scopeId: 'school-1',
      });
   });

   it('deve negar quando scope id e invalido', async () => {
      const config: ScopedAuthorizedConfig = {
         permission: 'school.update',
         scopeType: AclScopeType.school,
         scopeIdPath: 'where.id',
      };
      reflector.getAllAndOverride.mockImplementation((key: string) => {
         if (key === SCOPED_AUTH_KEY) return config;
         return undefined;
      });

      gqlCreateMock.mockReturnValue({
         getContext: () => ({ user: { id: 'user-1', role: RoleEnum.user } }),
         getArgs: () => ({ where: {} }),
      });

      await expect(guard.canActivate(createGraphqlContext())).rejects.toThrow(
         ForbiddenException,
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
