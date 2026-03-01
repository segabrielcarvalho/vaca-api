import {
   BadRequestException,
   Injectable,
   NotFoundException,
} from '@nestjs/common';
import {
   AclMembershipPermissionEffect,
   AclScopeType,
   Prisma,
} from '../../../../.prisma/client';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../auth/services/shared/scoped-access.service';
import { MyLogger } from '../../logger/my-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAclMembershipPermissionOverridesInput } from '../inputs/list-acl-membership-permission-overrides.input';
import { ListAssignableAclPermissionsInput } from '../inputs/list-assignable-acl-permissions.input';
import { RemoveAclMembershipPermissionOverrideInput } from '../inputs/remove-acl-membership-permission-override.input';
import { UpsertAclMembershipPermissionOverrideInput } from '../inputs/upsert-acl-membership-permission-override.input';
import { AclMembershipPermissionOverrideListObject } from '../objects/acl-membership-permission-override-list.object';
import { AclMembershipPermissionOverrideObject } from '../objects/acl-membership-permission-override.object';
import { AclPermissionOptionObject } from '../objects/acl-permission-option.object';

type MembershipWithScope = Prisma.AclMembershipGetPayload<{
   include: {
      Role: { select: { rank: true } };
      School: { select: { id: true; name: true } };
      Course: { select: { id: true; name: true; schoolId: true } };
      Klass: {
         select: {
            id: true;
            name: true;
            courseId: true;
            Course: { select: { id: true; name: true; schoolId: true } };
         };
      };
   };
}>;

type OverrideWithPermission = Prisma.AclMembershipPermissionOverrideGetPayload<{
   include: { Permission: { select: { code: true } } };
}>;

@Injectable()
export class AclMembershipPermissionOverrideService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
      private readonly logger: MyLogger,
   ) {
      this.logger.setContext(AclMembershipPermissionOverrideService.name);
   }

   async listAssignablePermissions(
      input: ListAssignableAclPermissionsInput,
   ): Promise<AclPermissionOptionObject[]> {
      const where = this.buildAssignablePermissionWhere(input.scopeType);

      const permissions = await this.prisma.aclPermission.findMany({
         where,
         orderBy: { code: 'asc' },
         select: { code: true },
      });

      return permissions.map((permission) => ({
         code: permission.code,
         scopeType: input.scopeType,
      }));
   }

   async list(
      user: AuthCurrentUser,
      input: ListAclMembershipPermissionOverridesInput,
   ): Promise<AclMembershipPermissionOverrideListObject> {
      await this.assertScopeExists(input.scopeType, input.scopeId);
      await this.scopedAccessService.assertCanManageMembership({
         user,
         scopeType: input.scopeType,
         scopeId: input.scopeId,
      });

      const membership = await this.findMembership(input);
      if (!membership) {
         throw new NotFoundException(
            'Membership ACL nao encontrada para listar overrides.',
         );
      }

      const take = this.normalizeTake(input.take, 20);
      const skip = this.normalizeSkip(input.skip);

      const [count, rows] = await Promise.all([
         this.prisma.aclMembershipPermissionOverride.count({
            where: { membershipId: membership.id },
         }),
         this.prisma.aclMembershipPermissionOverride.findMany({
            where: { membershipId: membership.id },
            include: { Permission: { select: { code: true } } },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take,
            skip,
         }),
      ]);

      return {
         count,
         rows: rows.map((row) =>
            this.mapOverride(input.scopeType, input.scopeId, membership, row),
         ),
      };
   }

   async upsert(
      user: AuthCurrentUser,
      input: UpsertAclMembershipPermissionOverrideInput,
   ): Promise<AclMembershipPermissionOverrideObject> {
      await this.assertScopeExists(input.scopeType, input.scopeId);

      const membership = await this.findMembership(input);
      if (!membership) {
         throw new NotFoundException('Membership ACL nao encontrada.');
      }

      await this.scopedAccessService.assertAssignableRole({
         user,
         scopeType: input.scopeType,
         scopeId: input.scopeId,
         targetRoleRank: membership.Role.rank,
      });

      const permission = await this.loadAssignablePermission(
         input.scopeType,
         input.permissionCode,
      );

      await this.scopedAccessService.assertPermission({
         user,
         permissionCode: permission.code,
         scopeType: input.scopeType,
         scopeId: input.scopeId,
      });

      const row = await this.prisma.aclMembershipPermissionOverride.upsert({
         where: {
            membershipId_permissionId: {
               membershipId: membership.id,
               permissionId: permission.id,
            },
         },
         update: {
            effect: input.effect,
         },
         create: {
            membershipId: membership.id,
            permissionId: permission.id,
            effect: input.effect,
         },
         include: { Permission: { select: { code: true } } },
      });

      return this.mapOverride(input.scopeType, input.scopeId, membership, row);
   }

   async remove(
      user: AuthCurrentUser,
      input: RemoveAclMembershipPermissionOverrideInput,
   ): Promise<AclMembershipPermissionOverrideObject> {
      await this.assertScopeExists(input.scopeType, input.scopeId);

      const membership = await this.findMembership(input);
      if (!membership) {
         throw new NotFoundException('Membership ACL nao encontrada.');
      }

      await this.scopedAccessService.assertAssignableRole({
         user,
         scopeType: input.scopeType,
         scopeId: input.scopeId,
         targetRoleRank: membership.Role.rank,
      });

      const permission = await this.loadAssignablePermission(
         input.scopeType,
         input.permissionCode,
      );

      await this.scopedAccessService.assertPermission({
         user,
         permissionCode: permission.code,
         scopeType: input.scopeType,
         scopeId: input.scopeId,
      });

      const existing =
         await this.prisma.aclMembershipPermissionOverride.findUnique({
            where: {
               membershipId_permissionId: {
                  membershipId: membership.id,
                  permissionId: permission.id,
               },
            },
            include: { Permission: { select: { code: true } } },
         });

      if (!existing) {
         throw new NotFoundException(
            'Override de permissao nao encontrado para este membership.',
         );
      }

      const row = await this.prisma.aclMembershipPermissionOverride.delete({
         where: {
            membershipId_permissionId: {
               membershipId: membership.id,
               permissionId: permission.id,
            },
         },
         include: { Permission: { select: { code: true } } },
      });

      return this.mapOverride(input.scopeType, input.scopeId, membership, row);
   }

   private async assertScopeExists(
      scopeType: AclScopeType,
      scopeId: string,
   ): Promise<void> {
      if (scopeType === AclScopeType.school) {
         const row = await this.prisma.school.findUnique({
            where: { id: scopeId },
            select: { id: true },
         });
         if (!row) throw new NotFoundException('School nao encontrada.');
         return;
      }

      if (scopeType === AclScopeType.course) {
         const row = await this.prisma.course.findUnique({
            where: { id: scopeId },
            select: { id: true },
         });
         if (!row) throw new NotFoundException('Course nao encontrado.');
         return;
      }

      const row = await this.prisma.klass.findUnique({
         where: { id: scopeId },
         select: { id: true },
      });
      if (!row) throw new NotFoundException('Klass nao encontrada.');
   }

   private async findMembership(input: {
      scopeType: AclScopeType;
      scopeId: string;
      agentId: string;
   }): Promise<MembershipWithScope | null> {
      return this.prisma.aclMembership.findUnique({
         where: this.getScopeUniqueWhere(
            input.scopeType,
            input.scopeId,
            input.agentId,
         ),
         include: {
            Role: { select: { rank: true } },
            School: { select: { id: true, name: true } },
            Course: { select: { id: true, name: true, schoolId: true } },
            Klass: {
               select: {
                  id: true,
                  name: true,
                  courseId: true,
                  Course: { select: { id: true, name: true, schoolId: true } },
               },
            },
         },
      });
   }

   private getScopeUniqueWhere(
      scopeType: AclScopeType,
      scopeId: string,
      agentId: string,
   ): Prisma.AclMembershipWhereUniqueInput {
      if (scopeType === AclScopeType.school) {
         return {
            schoolId_agentId: {
               schoolId: scopeId,
               agentId,
            },
         };
      }
      if (scopeType === AclScopeType.course) {
         return {
            courseId_agentId: {
               courseId: scopeId,
               agentId,
            },
         };
      }
      return {
         klassId_agentId: {
            klassId: scopeId,
            agentId,
         },
      };
   }

   private buildAssignablePermissionWhere(
      scopeType: AclScopeType,
   ): Prisma.AclPermissionWhereInput {
      return {
         OR: this.getAssignablePrefixes(scopeType).map((prefix) => ({
            code: {
               startsWith: prefix,
            },
         })),
      };
   }

   private getAssignablePrefixes(scopeType: AclScopeType): string[] {
      if (scopeType === AclScopeType.school) {
         return ['school.', 'course.', 'klass.'];
      }
      if (scopeType === AclScopeType.course) {
         return ['course.', 'klass.'];
      }
      return ['klass.'];
   }

   private async loadAssignablePermission(
      scopeType: AclScopeType,
      permissionCode: string,
   ): Promise<{ id: string; code: string }> {
      const normalizedCode = permissionCode.trim();
      if (normalizedCode.length === 0) {
         throw new BadRequestException('Permissao ACL invalida.');
      }

      const permission = await this.prisma.aclPermission.findFirst({
         where: {
            code: normalizedCode,
            ...this.buildAssignablePermissionWhere(scopeType),
         },
         select: {
            id: true,
            code: true,
         },
      });

      if (!permission) {
         throw new BadRequestException(
            'Permissao ACL nao encontrada ou incompativel com o escopo.',
         );
      }

      return permission;
   }

   private mapOverride(
      scopeType: AclScopeType,
      scopeId: string,
      membership: MembershipWithScope,
      row: OverrideWithPermission,
   ): AclMembershipPermissionOverrideObject {
      return {
         id: row.id,
         scopeType,
         scopeId,
         scopeName: this.resolveScopeName(scopeType, membership),
         agentId: membership.agentId,
         permissionCode: row.Permission.code,
         effect: row.effect as AclMembershipPermissionEffect,
         createdAt: row.createdAt,
         updatedAt: row.updatedAt,
      };
   }

   private resolveScopeName(
      scopeType: AclScopeType,
      membership: MembershipWithScope,
   ): string {
      if (scopeType === AclScopeType.school) {
         return membership.School?.name ?? membership.schoolId ?? '-';
      }
      if (scopeType === AclScopeType.course) {
         return membership.Course?.name ?? membership.courseId ?? '-';
      }
      return membership.Klass?.name ?? membership.klassId ?? '-';
   }

   private normalizeTake(value: number | null | undefined, fallback: number) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
         return fallback;
      }
      if (value <= 0) return fallback;
      return Math.min(Math.floor(value), 100);
   }

   private normalizeSkip(value: number | null | undefined) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
         return 0;
      }
      if (value < 0) return 0;
      return Math.floor(value);
   }
}
