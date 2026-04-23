import { AclScopeType } from '../../../../../.prisma/client';
import { AclDescendantMembershipService } from '../acl-descendant-membership.service';

describe('AclDescendantMembershipService', () => {
   let prisma: any;
   let service: AclDescendantMembershipService;

   beforeEach(() => {
      prisma = {
         aclRole: {
            findMany: jest.fn(),
         },
         course: {
            findMany: jest.fn(),
         },
         klass: {
            findMany: jest.fn(),
         },
         aclMembership: {
            upsert: jest.fn().mockResolvedValue({}),
         },
      };

      service = new AclDescendantMembershipService(prisma as any);
   });

   it('deve vincular admin de escola a todos os cursos e turmas ativas', async () => {
      prisma.aclRole.findMany.mockResolvedValue([
         { id: 'role-course-manager', code: 'course_manager' },
         { id: 'role-klass-manager', code: 'klass_manager' },
      ]);
      prisma.course.findMany.mockResolvedValue([
         {
            id: 'course-1',
            Klasses: [{ id: 'klass-1' }, { id: 'klass-2' }],
         },
         {
            id: 'course-2',
            Klasses: [{ id: 'klass-3' }],
         },
      ]);

      await service.syncForMembership({
         agentId: 'agent-1',
         scopeType: AclScopeType.school,
         scopeId: 'school-1',
         roleCode: 'school_manager',
      });

      expect(prisma.course.findMany).toHaveBeenCalledWith({
         where: {
            schoolId: 'school-1',
            isActive: true,
         },
         select: {
            id: true,
            Klasses: {
               where: { isActive: true },
               select: { id: true },
            },
         },
      });
      expect(prisma.aclMembership.upsert).toHaveBeenCalledTimes(5);
      expect(prisma.aclMembership.upsert).toHaveBeenCalledWith({
         where: {
            courseId_agentId: {
               courseId: 'course-1',
               agentId: 'agent-1',
            },
         },
         update: { roleId: 'role-course-manager' },
         create: {
            agentId: 'agent-1',
            courseId: 'course-1',
            roleId: 'role-course-manager',
         },
      });
      expect(prisma.aclMembership.upsert).toHaveBeenCalledWith({
         where: {
            klassId_agentId: {
               klassId: 'klass-3',
               agentId: 'agent-1',
            },
         },
         update: { roleId: 'role-klass-manager' },
         create: {
            agentId: 'agent-1',
            klassId: 'klass-3',
            roleId: 'role-klass-manager',
         },
      });
   });

   it('deve vincular admin de curso a todas as turmas ativas do curso', async () => {
      prisma.aclRole.findMany.mockResolvedValue([
         { id: 'role-klass-manager', code: 'klass_manager' },
      ]);
      prisma.klass.findMany.mockResolvedValue([
         { id: 'klass-1' },
         { id: 'klass-2' },
      ]);

      await service.syncForMembership({
         agentId: 'agent-1',
         scopeType: AclScopeType.course,
         scopeId: 'course-1',
         roleCode: 'course_manager',
      });

      expect(prisma.klass.findMany).toHaveBeenCalledWith({
         where: {
            courseId: 'course-1',
            isActive: true,
         },
         select: { id: true },
      });
      expect(prisma.aclMembership.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.aclMembership.upsert).toHaveBeenCalledWith({
         where: {
            klassId_agentId: {
               klassId: 'klass-2',
               agentId: 'agent-1',
            },
         },
         update: { roleId: 'role-klass-manager' },
         create: {
            agentId: 'agent-1',
            klassId: 'klass-2',
            roleId: 'role-klass-manager',
         },
      });
   });

   it('nao deve criar descendentes para vinculo direto em turma', async () => {
      await service.syncForMembership({
         agentId: 'agent-1',
         scopeType: AclScopeType.klass,
         scopeId: 'klass-1',
         roleCode: 'klass_manager',
      });

      expect(prisma.aclMembership.upsert).not.toHaveBeenCalled();
   });
});
