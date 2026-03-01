import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
   AclMembershipPermissionEffect,
   AclScopeType,
   RoleEnum,
} from '../../../../../.prisma/client';
import { AclMembershipPermissionOverrideService } from '../acl-membership-permission-override.service';

describe('AclMembershipPermissionOverrideService', () => {
   let prisma: any;
   let scopedAccessService: any;
   let logger: any;
   let service: AclMembershipPermissionOverrideService;

   beforeEach(() => {
      prisma = {
         school: { findUnique: jest.fn() },
         course: { findUnique: jest.fn() },
         klass: { findUnique: jest.fn() },
         aclMembership: { findUnique: jest.fn() },
         aclPermission: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
         },
         aclMembershipPermissionOverride: {
            count: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
         },
      };
      scopedAccessService = {
         assertCanManageMembership: jest.fn(),
         assertAssignableRole: jest.fn(),
         assertPermission: jest.fn(),
      };
      logger = {
         setContext: jest.fn(),
         debug: jest.fn(),
      };

      service = new AclMembershipPermissionOverrideService(
         prisma as any,
         scopedAccessService as any,
         logger as any,
      );
   });

   it('deve listar permissoes atribuíveis por escopo', async () => {
      prisma.aclPermission.findMany.mockResolvedValue([
         { code: 'course.update' },
         { code: 'klass.membership.manage' },
      ]);

      const result = await service.listAssignablePermissions({
         scopeType: AclScopeType.course,
      });

      expect(prisma.aclPermission.findMany).toHaveBeenCalled();
      expect(result).toEqual([
         { code: 'course.update', scopeType: AclScopeType.course },
         { code: 'klass.membership.manage', scopeType: AclScopeType.course },
      ]);
   });

   it('deve fazer upsert de override quando ator tem permissao e rank', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      prisma.aclMembership.findUnique.mockResolvedValue({
         id: 'membership-1',
         agentId: 'agent-target',
         roleId: 'role-1',
         schoolId: null,
         courseId: 'course-1',
         klassId: null,
         Role: { rank: 200 },
         School: null,
         Course: { id: 'course-1', name: 'Curso A', schoolId: 'school-1' },
         Klass: null,
      });
      prisma.aclPermission.findFirst.mockResolvedValue({
         id: 'permission-1',
         code: 'klass.membership.manage',
      });
      prisma.aclMembershipPermissionOverride.upsert.mockResolvedValue({
         id: 'override-1',
         createdAt: new Date('2026-01-01T00:00:00.000Z'),
         updatedAt: new Date('2026-01-01T00:00:00.000Z'),
         effect: AclMembershipPermissionEffect.allow,
         Permission: { code: 'klass.membership.manage' },
      });

      const result = await service.upsert(
         { id: 'user-1', role: RoleEnum.user } as any,
         {
            scopeType: AclScopeType.course,
            scopeId: 'course-1',
            agentId: 'agent-target',
            permissionCode: 'klass.membership.manage',
            effect: AclMembershipPermissionEffect.allow,
         },
      );

      expect(scopedAccessService.assertAssignableRole).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         scopeType: AclScopeType.course,
         scopeId: 'course-1',
         targetRoleRank: 200,
      });
      expect(scopedAccessService.assertPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         permissionCode: 'klass.membership.manage',
         scopeType: AclScopeType.course,
         scopeId: 'course-1',
      });
      expect(result.permissionCode).toBe('klass.membership.manage');
      expect(result.effect).toBe(AclMembershipPermissionEffect.allow);
   });

   it('deve falhar no upsert quando membership do alvo nao existir', async () => {
      prisma.school.findUnique.mockResolvedValue({ id: 'school-1' });
      prisma.aclMembership.findUnique.mockResolvedValue(null);

      await expect(
         service.upsert({ id: 'user-1', role: RoleEnum.user } as any, {
            scopeType: AclScopeType.school,
            scopeId: 'school-1',
            agentId: 'agent-target',
            permissionCode: 'school.update',
            effect: AclMembershipPermissionEffect.allow,
         }),
      ).rejects.toThrow(NotFoundException);
   });

   it('deve falhar no upsert para permissao incompatível com escopo', async () => {
      prisma.klass.findUnique.mockResolvedValue({ id: 'klass-1' });
      prisma.aclMembership.findUnique.mockResolvedValue({
         id: 'membership-1',
         agentId: 'agent-target',
         roleId: 'role-1',
         schoolId: null,
         courseId: null,
         klassId: 'klass-1',
         Role: { rank: 200 },
         School: null,
         Course: null,
         Klass: { id: 'klass-1', name: 'Turma A', courseId: 'course-1', Course: null },
      });
      prisma.aclPermission.findFirst.mockResolvedValue(null);

      await expect(
         service.upsert({ id: 'user-1', role: RoleEnum.user } as any, {
            scopeType: AclScopeType.klass,
            scopeId: 'klass-1',
            agentId: 'agent-target',
            permissionCode: 'course.update',
            effect: AclMembershipPermissionEffect.allow,
         }),
      ).rejects.toThrow(BadRequestException);
   });

   it('deve remover override existente', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      prisma.aclMembership.findUnique.mockResolvedValue({
         id: 'membership-1',
         agentId: 'agent-target',
         roleId: 'role-1',
         schoolId: null,
         courseId: 'course-1',
         klassId: null,
         Role: { rank: 200 },
         School: null,
         Course: { id: 'course-1', name: 'Curso A', schoolId: 'school-1' },
         Klass: null,
      });
      prisma.aclPermission.findFirst.mockResolvedValue({
         id: 'permission-1',
         code: 'klass.membership.manage',
      });
      prisma.aclMembershipPermissionOverride.findUnique.mockResolvedValue({
         id: 'override-1',
         createdAt: new Date('2026-01-01T00:00:00.000Z'),
         updatedAt: new Date('2026-01-01T00:00:00.000Z'),
         effect: AclMembershipPermissionEffect.deny,
         Permission: { code: 'klass.membership.manage' },
      });
      prisma.aclMembershipPermissionOverride.delete.mockResolvedValue({
         id: 'override-1',
         createdAt: new Date('2026-01-01T00:00:00.000Z'),
         updatedAt: new Date('2026-01-01T00:00:00.000Z'),
         effect: AclMembershipPermissionEffect.deny,
         Permission: { code: 'klass.membership.manage' },
      });

      const result = await service.remove(
         { id: 'user-1', role: RoleEnum.user } as any,
         {
            scopeType: AclScopeType.course,
            scopeId: 'course-1',
            agentId: 'agent-target',
            permissionCode: 'klass.membership.manage',
         },
      );

      expect(result.id).toBe('override-1');
      expect(result.effect).toBe(AclMembershipPermissionEffect.deny);
   });

   it('deve falhar ao remover override inexistente', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      prisma.aclMembership.findUnique.mockResolvedValue({
         id: 'membership-1',
         agentId: 'agent-target',
         roleId: 'role-1',
         schoolId: null,
         courseId: 'course-1',
         klassId: null,
         Role: { rank: 200 },
         School: null,
         Course: { id: 'course-1', name: 'Curso A', schoolId: 'school-1' },
         Klass: null,
      });
      prisma.aclPermission.findFirst.mockResolvedValue({
         id: 'permission-1',
         code: 'klass.membership.manage',
      });
      prisma.aclMembershipPermissionOverride.findUnique.mockResolvedValue(null);

      await expect(
         service.remove({ id: 'user-1', role: RoleEnum.user } as any, {
            scopeType: AclScopeType.course,
            scopeId: 'course-1',
            agentId: 'agent-target',
            permissionCode: 'klass.membership.manage',
         }),
      ).rejects.toThrow(NotFoundException);
   });
});

