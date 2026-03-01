jest.mock('winston-logsene', () => jest.fn());

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoleEnum } from '../../../../../../.prisma/client';
import { CreateKlassService } from '../../create/create-klass.service';

describe('CreateKlassService', () => {
   let prisma: {
      course: { findUnique: jest.Mock };
      klass: { create: jest.Mock };
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
      extractCourseConnectId: jest.Mock;
      normalizeName: jest.Mock;
      normalizeOptional: jest.Mock;
      assertActiveNameUniqueness: jest.Mock;
   };
   let service: CreateKlassService;

   beforeEach(() => {
      prisma = {
         course: { findUnique: jest.fn() },
         klass: { create: jest.fn() },
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
         extractCourseConnectId: jest.fn().mockReturnValue('course-1'),
         normalizeName: jest.fn(),
         normalizeOptional: jest.fn(),
         assertActiveNameUniqueness: jest.fn(),
      };

      service = new CreateKlassService(
         prisma as any,
         logger as any,
         rules as any,
      );
   });

   it('deve criar turma com payload saneado e atribuir owner ao criador', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      rules.normalizeName.mockReturnValue('Turma Alpha');
      rules.normalizeOptional
         .mockReturnValueOnce('Descricao curta')
         .mockReturnValueOnce(null);
      prisma.klass.create.mockResolvedValue({ id: 'klass-1' });
      prisma.aclRole.findUnique.mockResolvedValue({ id: 'role-klass-owner' });
      prisma.agent.findUnique.mockResolvedValue({ id: 'agent-1' });

      const result = await service.run(
         {
            data: {
               name: '  Turma  Alpha  ',
               description: '  Descricao curta  ',
               bannerPath: ' ',
               Course: { connect: { id: 'course-1' } },
            },
         } as any,
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(rules.assertActiveNameUniqueness).toHaveBeenCalledWith(
         'course-1',
         'Turma Alpha',
      );
      expect(prisma.klass.create).toHaveBeenCalledWith({
         data: {
            name: 'Turma Alpha',
            description: 'Descricao curta',
            bannerPath: null,
            isActive: true,
            Course: {
               connect: { id: 'course-1' },
            },
         },
      });
      expect(prisma.aclMembership.upsert).toHaveBeenCalledWith({
         where: {
            klassId_agentId: {
               klassId: 'klass-1',
               agentId: 'agent-1',
            },
         },
         update: { roleId: 'role-klass-owner' },
         create: {
            klassId: 'klass-1',
            agentId: 'agent-1',
            roleId: 'role-klass-owner',
         },
      });
      expect(result).toEqual({ id: 'klass-1' });
   });

   it('deve falhar quando curso nao existir', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      rules.normalizeName.mockReturnValue('Turma Alpha');

      await expect(
         service.run(
            {
               data: {
                  name: 'Turma Alpha',
                  Course: { connect: { id: 'course-1' } },
               },
            } as any,
            { id: 'user-1', role: RoleEnum.user } as any,
         ),
      ).rejects.toThrow(NotFoundException);
   });

   it('deve falhar quando usuario nao possuir Agent para ownership', async () => {
      prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
      rules.normalizeName.mockReturnValue('Turma Alpha');
      rules.normalizeOptional.mockReturnValue(undefined);
      prisma.klass.create.mockResolvedValue({ id: 'klass-1' });
      prisma.aclRole.findUnique.mockResolvedValue({ id: 'role-klass-owner' });
      prisma.agent.findUnique.mockResolvedValue(null);

      await expect(
         service.run(
            {
               data: {
                  name: 'Turma Alpha',
                  Course: { connect: { id: 'course-1' } },
               },
            } as any,
            { id: 'user-1', role: RoleEnum.user } as any,
         ),
      ).rejects.toThrow(BadRequestException);
   });
});
