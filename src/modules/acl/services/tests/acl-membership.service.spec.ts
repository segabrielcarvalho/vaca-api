import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AclScopeType, RoleEnum } from '../../../../../.prisma/client';
import { AclMembershipService } from '../acl-membership.service';

describe('AclMembershipService', () => {
   let prisma: any;
   let scopedAccessService: any;
   let descendantMembershipService: any;
   let logger: any;
   let service: AclMembershipService;

   beforeEach(() => {
      prisma = {
         school: { findUnique: jest.fn() },
         course: { findUnique: jest.fn() },
         klass: { findUnique: jest.fn() },
         aclRole: { findUnique: jest.fn() },
         aclMembership: {
            upsert: jest.fn(),
            findUnique: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            findMany: jest.fn(),
         },
      };
      scopedAccessService = {
         assertAssignableRole: jest.fn(),
         assertCanManageMembership: jest.fn(),
      };
      descendantMembershipService = {
         syncForMembership: jest.fn().mockResolvedValue(undefined),
      };
      logger = {
         setContext: jest.fn(),
         debug: jest.fn(),
      };

      service = new AclMembershipService(
         prisma as any,
         scopedAccessService as any,
         descendantMembershipService as any,
         logger as any,
      );
   });

   it('deve fazer upsert de membership school com role compativel', async () => {
      prisma.school.findUnique.mockResolvedValue({ id: 'school-1' });
      prisma.aclRole.findUnique.mockResolvedValue({
         id: 'role-1',
         code: 'school_manager',
         rank: 300,
         scopeType: AclScopeType.school,
      });
      prisma.aclMembership.upsert.mockResolvedValue({
         id: 'm-1',
         agentId: 'agent-1',
         createdAt: new Date('2026-01-01T00:00:00.000Z'),
         updatedAt: new Date('2026-01-01T00:00:00.000Z'),
         Role: {
            code: 'school_manager',
            rank: 300,
         },
      });

      const result = await service.upsert(
         { id: 'user-1', role: RoleEnum.user } as any,
         {
            scopeType: AclScopeType.school,
            scopeId: 'school-1',
            agentId: 'agent-1',
            roleCode: 'school_manager',
         },
      );

      expect(scopedAccessService.assertAssignableRole).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         scopeType: AclScopeType.school,
         scopeId: 'school-1',
         targetRoleRank: 300,
      });
      expect(descendantMembershipService.syncForMembership).toHaveBeenCalledWith(
         {
            agentId: 'agent-1',
            scopeType: AclScopeType.school,
            scopeId: 'school-1',
            roleCode: 'school_manager',
         },
      );
      expect(result.roleCode).toBe('school_manager');
   });

   it('deve falhar quando role nao pertencer ao escopo', async () => {
      prisma.school.findUnique.mockResolvedValue({ id: 'school-1' });
      prisma.aclRole.findUnique.mockResolvedValue({
         id: 'role-1',
         code: 'course_manager',
         rank: 300,
         scopeType: AclScopeType.course,
      });

      await expect(
         service.upsert({ id: 'user-1', role: RoleEnum.user } as any, {
            scopeType: AclScopeType.school,
            scopeId: 'school-1',
            agentId: 'agent-1',
            roleCode: 'course_manager',
         }),
      ).rejects.toThrow(BadRequestException);
   });

   it('deve falhar ao remover membership inexistente', async () => {
      prisma.school.findUnique.mockResolvedValue({ id: 'school-1' });
      prisma.aclMembership.findUnique.mockResolvedValue(null);

      await expect(
         service.remove({ id: 'user-1', role: RoleEnum.user } as any, {
            scopeType: AclScopeType.school,
            scopeId: 'school-1',
            agentId: 'agent-1',
         }),
      ).rejects.toThrow(NotFoundException);
   });

   it('deve listar memberships por escopo usando filtro unico', async () => {
      prisma.aclMembership.count.mockResolvedValue(1);
      prisma.aclMembership.findMany.mockResolvedValue([
         {
            id: 'm-1',
            agentId: 'agent-1',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            Role: { code: 'course_viewer', rank: 100 },
         },
      ]);

      const result = await service.list(
         { id: 'user-1', role: RoleEnum.user } as any,
         {
            scopeType: AclScopeType.course,
            scopeId: 'course-1',
            take: 10,
            skip: 0,
         },
      );

      expect(prisma.aclMembership.count).toHaveBeenCalledWith({
         where: { courseId: 'course-1' },
      });
      expect(result.count).toBe(1);
      expect(result.rows[0].scopeType).toBe(AclScopeType.course);
      expect(result.rows[0].scopeId).toBe('course-1');
   });
});
