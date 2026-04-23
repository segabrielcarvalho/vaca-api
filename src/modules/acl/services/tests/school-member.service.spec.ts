import { RoleEnum } from '../../../../../.prisma/client';
import { SchoolMemberService } from '../school-member.service';

describe('SchoolMemberService', () => {
   let prisma: any;
   let scopedAccessService: any;
   let descendantMembershipService: any;
   let service: SchoolMemberService;

   beforeEach(() => {
      prisma = {
         agent: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
            upsert: jest.fn(),
         },
         user: {
            findUnique: jest.fn(),
         },
         aclRole: {
            findUnique: jest.fn(),
         },
         aclMembership: {
            upsert: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
         },
         course: {
            findUnique: jest.fn(),
         },
         klass: {
            findUnique: jest.fn(),
         },
         authInvite: {
            findFirst: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
         },
      };
      scopedAccessService = {
         assertCanManageMembership: jest.fn().mockResolvedValue(undefined),
         assertAssignableRole: jest.fn().mockResolvedValue(undefined),
      };
      descendantMembershipService = {
         syncForMembership: jest.fn().mockResolvedValue(undefined),
      };

      service = new SchoolMemberService(
         prisma as any,
         scopedAccessService as any,
         { run: jest.fn() } as any,
         descendantMembershipService as any,
         { setContext: jest.fn() } as any,
      );
   });

   it('deve listar no curso membros vinculados na escola, no curso ou nas turmas do curso', async () => {
      prisma.course.findUnique.mockResolvedValue({
         id: 'course-1',
         schoolId: 'school-1',
      });

      await service.listSchoolMembers(
         { id: 'user-1', role: RoleEnum.user } as any,
         {
            schoolId: 'school-1',
            courseId: 'course-1',
         },
      );

      expect(prisma.agent.count).toHaveBeenCalledWith({
         where: {
            Memberships: {
               some: {
                  OR: [
                     { schoolId: 'school-1' },
                     {
                        OR: [
                           { courseId: 'course-1' },
                           {
                              Klass: {
                                 is: {
                                    courseId: 'course-1',
                                 },
                              },
                           },
                        ],
                     },
                  ],
               },
            },
         },
      });
   });

   it('deve sincronizar descendentes antes de listar membros da escola', async () => {
      prisma.aclMembership.findMany.mockResolvedValue([
         {
            agentId: 'agent-1',
            schoolId: 'school-1',
            courseId: null,
            Role: { code: 'school_manager' },
         },
      ]);

      await service.listSchoolMembers(
         { id: 'user-1', role: RoleEnum.user } as any,
         {
            schoolId: 'school-1',
         },
      );

      expect(prisma.aclMembership.findMany).toHaveBeenCalledWith({
         where: { schoolId: 'school-1' },
         select: {
            agentId: true,
            schoolId: true,
            courseId: true,
            Role: {
               select: {
                  code: true,
               },
            },
         },
      });
      expect(descendantMembershipService.syncForMembership).toHaveBeenCalledWith(
         {
            agentId: 'agent-1',
            scopeType: 'school',
            scopeId: 'school-1',
            roleCode: 'school_manager',
         },
      );
   });

   it('deve listar na turma membros vinculados na escola, no curso ou somente naquela turma', async () => {
      prisma.klass.findUnique.mockResolvedValue({
         id: 'klass-1',
         courseId: 'course-1',
         Course: {
            schoolId: 'school-1',
         },
      });

      await service.listSchoolMembers(
         { id: 'user-1', role: RoleEnum.user } as any,
         {
            schoolId: 'school-1',
            klassId: 'klass-1',
         },
      );

      expect(prisma.agent.count).toHaveBeenCalledWith({
         where: {
            Memberships: {
               some: {
                  OR: [
                     { schoolId: 'school-1' },
                     { klassId: 'klass-1' },
                     { courseId: 'course-1' },
                  ],
               },
            },
         },
      });
   });

   it('deve listar convites somente do metadata da escola atual', async () => {
      const now = new Date('2026-04-23T12:00:00.000Z');
      const expiresAt = new Date('2026-04-26T12:00:00.000Z');
      prisma.agent.findMany.mockResolvedValue([
         {
            id: 'agent-1',
            userId: 'user-1',
            Memberships: [
               {
                  schoolId: 'school-1',
                  Role: { code: 'school_manager' },
               },
            ],
         },
      ]);
      prisma.authInvite.findMany.mockResolvedValue([
         {
            id: 'invite-school-2',
            email: 'gabriel@example.com',
            userId: 'user-1',
            invitedByUserId: 'admin-1',
            metadata: {
               raw: JSON.stringify({
                  source: 'school_members_admin',
                  schoolId: 'school-2',
                  roleCode: 'school_manager',
               }),
            },
            createdAt: now,
            expiresAt,
            acceptedAt: null,
            revokedAt: null,
         },
         {
            id: 'invite-school-1',
            email: 'gabriel@example.com',
            userId: 'user-1',
            invitedByUserId: 'admin-1',
            metadata: {
               raw: JSON.stringify({
                  source: 'school_members_admin',
                  schoolId: 'school-1',
                  roleCode: 'school_manager',
               }),
            },
            createdAt: now,
            expiresAt,
            acceptedAt: null,
            revokedAt: null,
         },
         {
            id: 'invite-without-scope',
            email: 'gabriel@example.com',
            userId: 'user-1',
            invitedByUserId: 'admin-1',
            metadata: null,
            createdAt: now,
            expiresAt,
            acceptedAt: null,
            revokedAt: null,
         },
      ]);

      const result = await service.listSchoolMemberInvites(
         { id: 'user-admin', role: RoleEnum.user } as any,
         {
            schoolId: 'school-1',
         },
      );

      expect(result.count).toBe(1);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].inviteId).toBe('invite-school-1');
   });

   it('deve sincronizar cursos e turmas ao convidar membro no escopo da escola', async () => {
      prisma.aclRole.findUnique.mockResolvedValue({
         id: 'role-school-manager',
         code: 'school_manager',
         rank: 300,
         scopeType: 'school',
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'target-user-1' });
      prisma.agent.upsert.mockResolvedValue({ id: 'agent-1' });
      prisma.aclMembership.upsert.mockResolvedValue({});
      prisma.authInvite.findFirst.mockResolvedValue({
         id: 'invite-1',
         email: 'gabriel@example.com',
         userId: 'target-user-1',
         invitedByUserId: 'admin-1',
         createdAt: new Date('2026-04-23T12:00:00.000Z'),
         expiresAt: new Date('2026-04-26T12:00:00.000Z'),
         acceptedAt: null,
         revokedAt: null,
      });

      await service.inviteSchoolMember(
         { id: 'user-admin', role: RoleEnum.user } as any,
         {
            schoolId: 'school-1',
            email: 'gabriel@example.com',
            roleCode: 'school_manager',
         },
      );

      expect(descendantMembershipService.syncForMembership).toHaveBeenCalledWith(
         {
            agentId: 'agent-1',
            scopeType: 'school',
            scopeId: 'school-1',
            roleCode: 'school_manager',
         },
      );
   });
});
