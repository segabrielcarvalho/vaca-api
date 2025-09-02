import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import { RolesGuard } from '../guards/roles.guard';

export const ROLES_KEY = 'roles';
export const Authorized = (...roles: (keyof typeof RoleEnum)[]) => {
   return applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(RolesGuard));
};
