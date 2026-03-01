jest.mock('winston-logsene', () => jest.fn());

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoleEnum } from '../../../../../../.prisma/client';
import { CreateCourseService } from '../../create/create-course.service';

describe('CreateCourseService', () => {
   let prisma: {
      school: { findUnique: jest.Mock };
      course: { create: jest.Mock };
      aclRole: { findUnique: jest.Mock };
      agent: { findUnique: jest.Mock };
      aclMembership: { upsert: jest.Mock };
   };
   let logger: {
      setContext: jest.Mock;
      debug: jest.Mock;
      log: jest.Mock;
   };
   let rules: {
      detectUnsupportedNestedOperations: jest.Mock;
      extractSchoolConnectId: jest.Mock;
      normalizeName: jest.Mock;
      normalizeOptional: jest.Mock;
      assertActiveNameUniqueness: jest.Mock;
   };
   let service: CreateCourseService;

   beforeEach(() => {
      prisma = {
         school: { findUnique: jest.fn() },
         course: { create: jest.fn() },
         aclRole: { findUnique: jest.fn() },
         agent: { findUnique: jest.fn() },
         aclMembership: { upsert: jest.fn() },
      };
      logger = {
         setContext: jest.fn(),
         debug: jest.fn(),
         log: jest.fn(),
      };
      rules = {
         detectUnsupportedNestedOperations: jest.fn(),
         extractSchoolConnectId: jest.fn().mockReturnValue('school-1'),
         normalizeName: jest.fn(),
         normalizeOptional: jest.fn(),
         assertActiveNameUniqueness: jest.fn(),
      };

      service = new CreateCourseService(
         prisma as any,
         logger as any,
         rules as any,
      );
   });

   it('deve criar curso com payload saneado e atribuir owner ao criador', async () => {
      prisma.school.findUnique.mockResolvedValue({ id: 'school-1' });
      rules.normalizeName.mockReturnValue('Curso Alpha');
      rules.normalizeOptional
         .mockReturnValueOnce('Descricao curta')
         .mockReturnValueOnce(null);
      prisma.course.create.mockResolvedValue({ id: 'course-1' });
      prisma.aclRole.findUnique.mockResolvedValue({ id: 'role-course-owner' });
      prisma.agent.findUnique.mockResolvedValue({ id: 'agent-1' });

      const result = await service.run(
         {
            data: {
               name: '  Curso  Alpha  ',
               description: '  Descricao curta  ',
               bannerPath: ' ',
               School: { connect: { id: 'school-1' } },
            },
         } as any,
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(rules.assertActiveNameUniqueness).toHaveBeenCalledWith(
         'school-1',
         'Curso Alpha',
      );
      expect(prisma.course.create).toHaveBeenCalledWith({
         data: {
            name: 'Curso Alpha',
            description: 'Descricao curta',
            bannerPath: null,
            isActive: true,
            School: {
               connect: { id: 'school-1' },
            },
         },
      });
      expect(prisma.aclMembership.upsert).toHaveBeenCalledWith({
         where: {
            courseId_agentId: {
               courseId: 'course-1',
               agentId: 'agent-1',
            },
         },
         update: { roleId: 'role-course-owner' },
         create: {
            courseId: 'course-1',
            agentId: 'agent-1',
            roleId: 'role-course-owner',
         },
      });
      expect(result).toEqual({ id: 'course-1' });
   });

   it('deve falhar quando school nao existir', async () => {
      prisma.school.findUnique.mockResolvedValue(null);
      rules.normalizeName.mockReturnValue('Curso Alpha');

      await expect(
         service.run(
            {
               data: {
                  name: 'Curso Alpha',
                  School: { connect: { id: 'school-1' } },
               },
            } as any,
            { id: 'user-1', role: RoleEnum.user } as any,
         ),
      ).rejects.toThrow(NotFoundException);
   });

   it('deve falhar quando usuario nao possuir Agent para ownership', async () => {
      prisma.school.findUnique.mockResolvedValue({ id: 'school-1' });
      rules.normalizeName.mockReturnValue('Curso Alpha');
      rules.normalizeOptional.mockReturnValue(undefined);
      prisma.course.create.mockResolvedValue({ id: 'course-1' });
      prisma.aclRole.findUnique.mockResolvedValue({ id: 'role-course-owner' });
      prisma.agent.findUnique.mockResolvedValue(null);

      await expect(
         service.run(
            {
               data: {
                  name: 'Curso Alpha',
                  School: { connect: { id: 'school-1' } },
               },
            } as any,
            { id: 'user-1', role: RoleEnum.user } as any,
         ),
      ).rejects.toThrow(BadRequestException);
   });
});
