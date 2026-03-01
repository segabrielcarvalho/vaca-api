import { ForbiddenException } from '@nestjs/common';
import { AclScopeType, RoleEnum } from '../../../../../../.prisma/client';
import { ScopedAccessService } from '../../shared/scoped-access.service';

describe('ScopedAccessService', () => {
   let prisma: any;
   let service: ScopedAccessService;

   beforeEach(() => {
      prisma = {
         agent: { findUnique: jest.fn() },
         aclMembership: { findFirst: jest.fn() },
         course: { findUnique: jest.fn() },
         klass: { findUnique: jest.fn() },
      };
      service = new ScopedAccessService(prisma as any);
   });

   it('deve permitir admin sem consultar memberships', async () => {
      await service.assertPermission({
         user: { id: 'user-1', role: RoleEnum.admin } as any,
         permissionCode: 'school.update',
         scopeType: AclScopeType.school,
         scopeId: 'school-1',
      });

      expect(prisma.agent.findUnique).not.toHaveBeenCalled();
   });

   it('deve permitir permissao herdada de school para recurso course', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'agent-1' });
      prisma.course.findUnique.mockResolvedValue({ schoolId: 'school-1' });
      prisma.aclMembership.findFirst
         .mockResolvedValueOnce({
            PermissionOverrides: [],
            Role: { RolePermissions: [] },
         })
         .mockResolvedValueOnce({
            PermissionOverrides: [],
            Role: { RolePermissions: [{ id: 'rp-1' }] },
         });

      await expect(
         service.assertPermission({
            user: { id: 'user-1', role: RoleEnum.user } as any,
            permissionCode: 'course.update',
            scopeType: AclScopeType.course,
            scopeId: 'course-1',
         }),
      ).resolves.toBeUndefined();
   });

   it('deve bloquear atribuicao de role igual ao rank do ator', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'agent-1' });
      prisma.aclMembership.findFirst
         .mockResolvedValueOnce({
            PermissionOverrides: [],
            Role: { RolePermissions: [{ id: 'rp-1' }] },
         })
         .mockResolvedValueOnce({ Role: { rank: 300 } });

      await expect(
         service.assertAssignableRole({
            user: { id: 'user-1', role: RoleEnum.user } as any,
            scopeType: AclScopeType.school,
            scopeId: 'school-1',
            targetRoleRank: 300,
         }),
      ).rejects.toThrow(ForbiddenException);
   });

   it('deve negar quando houver override deny no escopo mais especifico', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'agent-1' });
      prisma.course.findUnique.mockResolvedValue({ schoolId: 'school-1' });
      prisma.aclMembership.findFirst.mockResolvedValueOnce({
         PermissionOverrides: [{ effect: 'deny' }],
         Role: { RolePermissions: [{ id: 'rp-1' }] },
      });

      await expect(
         service.assertPermission({
            user: { id: 'user-1', role: RoleEnum.user } as any,
            permissionCode: 'klass.membership.manage',
            scopeType: AclScopeType.course,
            scopeId: 'course-1',
         }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.aclMembership.findFirst).toHaveBeenCalledTimes(1);
   });

   it('deve permitir quando houver override allow no escopo mais especifico', async () => {
      prisma.agent.findUnique.mockResolvedValue({ id: 'agent-1' });
      prisma.course.findUnique.mockResolvedValue({ schoolId: 'school-1' });
      prisma.aclMembership.findFirst.mockResolvedValueOnce({
         PermissionOverrides: [{ effect: 'allow' }],
         Role: { RolePermissions: [] },
      });

      await expect(
         service.assertPermission({
            user: { id: 'user-1', role: RoleEnum.user } as any,
            permissionCode: 'klass.membership.manage',
            scopeType: AclScopeType.course,
            scopeId: 'course-1',
         }),
      ).resolves.toBeUndefined();
   });
});
