import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import { UnauthorizedByRolesGuard } from '../guards/unauthorized-by-roles.guard';

export const ROLES_KEY = 'roles';
export const Unauthorized = (...roles: RoleEnum[]) => {
   return applyDecorators(
      SetMetadata(ROLES_KEY, roles),
      UseGuards(UnauthorizedByRolesGuard),
   );
};
