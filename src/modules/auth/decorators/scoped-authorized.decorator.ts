import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { AclScopeType } from '../../../../.prisma/client';
import { ScopedAccessGuard } from '../guards/scoped-access.guard';

export const SCOPED_AUTH_KEY = 'scoped-auth';

export type ScopedAuthorizedConfig = {
   permission?: string;
   permissionFromScopeManage?: boolean;
   scopeType?: AclScopeType;
   scopeTypePath?: string;
   scopeIdPath: string;
};

export const ScopedAuthorized = (config: ScopedAuthorizedConfig) => {
   return applyDecorators(
      SetMetadata(SCOPED_AUTH_KEY, config),
      UseGuards(ScopedAccessGuard),
   );
};
