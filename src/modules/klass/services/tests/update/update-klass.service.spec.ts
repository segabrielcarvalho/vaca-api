jest.mock('winston-logsene', () => jest.fn());

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AclScopeType, RoleEnum } from '../../../../../../.prisma/client';
import { UpdateKlassService } from '../../update/update-klass.service';

describe('UpdateKlassService', () => {
   let prisma: {
      course: { findUnique: jest.Mock };
      klass: {
         findUnique: jest.Mock;
         update: jest.Mock;
      };
   };
   let logger: {
      setContext: jest.Mock;
      debug: jest.Mock;
      warn: jest.Mock;
      log: jest.Mock;
   };
   let rules: {
      extractKlassId: jest.Mock;
      detectUnsupportedNestedOperations: jest.Mock;
      extractCourseConnectId: jest.Mock;
      normalizeName: jest.Mock;
      normalizeOptional: jest.Mock;
      assertActiveNameUniqueness: jest.Mock;
   };
   let scopedAccessService: {
      assertPermission: jest.Mock;
   };
   let service: UpdateKlassService;

   beforeEach(() => {
      prisma = {
         course: { findUnique: jest.fn() },
         klass: {
            findUnique: jest.fn(),
            update: jest.fn(),
         },
      };
      logger = {
         setContext: jest.fn(),
         debug: jest.fn(),
         warn: jest.fn(),
         log: jest.fn(),
      };
      rules = {
         extractKlassId: jest.fn().mockReturnValue('klass-1'),
         detectUnsupportedNestedOperations: jest.fn(),
         extractCourseConnectId: jest.fn().mockReturnValue('course-2'),
         normalizeName: jest.fn(),
         normalizeOptional: jest.fn(),
         assertActiveNameUniqueness: jest.fn(),
      };
      scopedAccessService = {
         assertPermission: jest.fn(),
      };

      service = new UpdateKlassService(
         prisma as any,
         logger as any,
         rules as any,
         scopedAccessService as any,
      );
   });

   it('deve atualizar turma ativa com campos permitidos', async () => {
      prisma.klass.findUnique.mockResolvedValue({
         id: 'klass-1',
         courseId: 'course-1',
         isActive: true,
         name: 'Atual',
      });
      rules.normalizeName.mockReturnValue('Novo Nome');
      prisma.klass.update.mockResolvedValue({
         id: 'klass-1',
         name: 'Novo Nome',
      });

      const result = await service.run(
         {
            where: { id: 'klass-1' },
            data: {
               name: { set: ' Novo Nome ' },
            },
         } as any,
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(scopedAccessService.assertPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         permissionCode: 'klass.update',
         scopeType: AclScopeType.klass,
         scopeId: 'klass-1',
      });
      expect(rules.assertActiveNameUniqueness).toHaveBeenCalledWith(
         'course-1',
         'Novo Nome',
         'klass-1',
      );
      expect(prisma.klass.update).toHaveBeenCalledWith({
         where: { id: 'klass-1' },
         data: {
            name: 'Novo Nome',
         },
      });
      expect(result).toEqual({ id: 'klass-1', name: 'Novo Nome' });
   });

   it('deve falhar se Course.connect apontar para course inexistente', async () => {
      prisma.klass.findUnique.mockResolvedValue({
         id: 'klass-1',
         courseId: 'course-1',
         isActive: true,
         name: 'Atual',
      });
      prisma.course.findUnique.mockResolvedValue(null);

      await expect(
         service.run({
            where: { id: 'klass-1' },
            data: {
               Course: { connect: { id: 'course-2' } },
            },
         } as any),
      ).rejects.toThrow(NotFoundException);
   });

   it('deve bloquear update em turma inativa quando nao for reativacao', async () => {
      prisma.klass.findUnique.mockResolvedValue({
         id: 'klass-1',
         courseId: 'course-1',
         isActive: false,
         name: 'Turma Inativa',
      });
      rules.normalizeName.mockReturnValue('Outro Nome');

      await expect(
         service.run({
            where: { id: 'klass-1' },
            data: { name: { set: 'Outro Nome' } },
         } as any),
      ).rejects.toThrow(BadRequestException);
   });

   it('deve permitir reativacao de turma inativa', async () => {
      prisma.klass.findUnique.mockResolvedValue({
         id: 'klass-1',
         courseId: 'course-1',
         isActive: false,
         name: 'Turma Inativa',
      });
      prisma.klass.update.mockResolvedValue({
         id: 'klass-1',
         isActive: true,
      });

      const result = await service.run({
         where: { id: 'klass-1' },
         data: { isActive: { set: true } },
      } as any);

      expect(rules.assertActiveNameUniqueness).toHaveBeenCalledWith(
         'course-1',
         'Turma Inativa',
         'klass-1',
      );
      expect(prisma.klass.update).toHaveBeenCalledWith({
         where: { id: 'klass-1' },
         data: { isActive: true },
      });
      expect(result).toEqual({ id: 'klass-1', isActive: true });
   });
});
