import {
   CanActivate,
   ExecutionContext,
   ForbiddenException,
   Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AclScopeType } from '../../../../.prisma/client';
import {
   SCOPED_AUTH_KEY,
   ScopedAuthorizedConfig,
} from '../decorators/scoped-authorized.decorator';
import { AuthCurrentUser } from '../services/auth-context.service';
import { ScopedAccessService } from '../services/shared/scoped-access.service';

type Dict = Record<string, unknown>;

@Injectable()
export class ScopedAccessGuard implements CanActivate {
   constructor(
      private readonly reflector: Reflector,
      private readonly scopedAccessService: ScopedAccessService,
   ) {}

   async canActivate(context: ExecutionContext): Promise<boolean> {
      const config = this.reflector.getAllAndOverride<ScopedAuthorizedConfig>(
         SCOPED_AUTH_KEY,
         [context.getHandler(), context.getClass()],
      );

      if (!config) return true;

      const gqlContext = GqlExecutionContext.create(context);
      const request = gqlContext.getContext<{ user?: AuthCurrentUser }>();
      const user = request?.user;
      if (!user) {
         throw new ForbiddenException('Acesso negado');
      }

      const args = gqlContext.getArgs<Dict>();
      const scopeType = this.resolveScopeType(config, args);
      const scopeId = this.readPath(args, config.scopeIdPath);

      if (typeof scopeId !== 'string' || scopeId.trim().length === 0) {
         throw new ForbiddenException('Acesso negado');
      }

      const permissionCode = this.resolvePermissionCode(config, scopeType);

      await this.scopedAccessService.assertPermission({
         user,
         permissionCode,
         scopeType,
         scopeId: scopeId.trim(),
      });

      return true;
   }

   private resolvePermissionCode(
      config: ScopedAuthorizedConfig,
      scopeType: AclScopeType,
   ): string {
      if (config.permission) {
         return config.permission;
      }

      if (config.permissionFromScopeManage) {
         return `${scopeType}.membership.manage`;
      }

      throw new ForbiddenException('Acesso negado');
   }

   private resolveScopeType(
      config: ScopedAuthorizedConfig,
      args: Dict,
   ): AclScopeType {
      if (config.scopeType) return config.scopeType;
      if (!config.scopeTypePath) {
         throw new ForbiddenException('Acesso negado');
      }

      const value = this.readPath(args, config.scopeTypePath);
      if (
         value === AclScopeType.school ||
         value === AclScopeType.course ||
         value === AclScopeType.klass
      ) {
         return value;
      }

      throw new ForbiddenException('Acesso negado');
   }

   private readPath(input: Dict, path: string): unknown {
      const parts = path.split('.');
      let current: unknown = input;

      for (const part of parts) {
         if (!current || typeof current !== 'object') return undefined;
         current = (current as Dict)[part];
      }

      return current;
   }
}
