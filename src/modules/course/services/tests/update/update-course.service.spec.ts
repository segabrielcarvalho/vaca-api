jest.mock('winston-logsene', () => jest.fn());

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AclScopeType, RoleEnum } from '../../../../../../.prisma/client';
import { UpdateCourseService } from '../../update/update-course.service';

describe('UpdateCourseService', () => {
   let prisma: {
      school: { findUnique: jest.Mock };
      course: {
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
      extractCourseId: jest.Mock;
      detectUnsupportedNestedOperations: jest.Mock;
      extractSchoolConnectId: jest.Mock;
      normalizeName: jest.Mock;
      normalizeOptional: jest.Mock;
      assertActiveNameUniqueness: jest.Mock;
   };
   let scopedAccessService: {
      assertPermission: jest.Mock;
   };
   let service: UpdateCourseService;

   beforeEach(() => {
      prisma = {
         school: { findUnique: jest.fn() },
         course: {
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
         extractCourseId: jest.fn().mockReturnValue('course-1'),
         detectUnsupportedNestedOperations: jest.fn(),
         extractSchoolConnectId: jest.fn().mockReturnValue('school-2'),
         normalizeName: jest.fn(),
         normalizeOptional: jest.fn(),
         assertActiveNameUniqueness: jest.fn(),
      };
      scopedAccessService = {
         assertPermission: jest.fn(),
      };

      service = new UpdateCourseService(
         prisma as any,
         logger as any,
         rules as any,
         scopedAccessService as any,
      );
   });

   it('deve atualizar curso ativo com campos permitidos', async () => {
      prisma.course.findUnique.mockResolvedValue({
         id: 'course-1',
         schoolId: 'school-1',
         isActive: true,
         name: 'Atual',
      });
      rules.normalizeName.mockReturnValue('Novo Nome');
      prisma.course.update.mockResolvedValue({
         id: 'course-1',
         name: 'Novo Nome',
      });

      const result = await service.run(
         {
            where: { id: 'course-1' },
            data: {
               name: { set: ' Novo Nome ' },
            },
         } as any,
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(scopedAccessService.assertPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         permissionCode: 'course.update',
         scopeType: AclScopeType.course,
         scopeId: 'course-1',
      });
      expect(rules.assertActiveNameUniqueness).toHaveBeenCalledWith(
         'school-1',
         'Novo Nome',
         'course-1',
      );
      expect(prisma.course.update).toHaveBeenCalledWith({
         where: { id: 'course-1' },
         data: {
            name: 'Novo Nome',
         },
      });
      expect(result).toEqual({ id: 'course-1', name: 'Novo Nome' });
   });

   it('deve falhar se School.connect apontar para school inexistente', async () => {
      prisma.course.findUnique.mockResolvedValue({
         id: 'course-1',
         schoolId: 'school-1',
         isActive: true,
         name: 'Atual',
      });
      prisma.school.findUnique.mockResolvedValue(null);

      await expect(
         service.run({
            where: { id: 'course-1' },
            data: {
               School: { connect: { id: 'school-2' } },
            },
         } as any),
      ).rejects.toThrow(NotFoundException);
   });

   it('deve bloquear update em curso inativo quando nao for reativacao', async () => {
      prisma.course.findUnique.mockResolvedValue({
         id: 'course-1',
         schoolId: 'school-1',
         isActive: false,
         name: 'Curso Inativo',
      });
      rules.normalizeName.mockReturnValue('Outro Nome');

      await expect(
         service.run({
            where: { id: 'course-1' },
            data: { name: { set: 'Outro Nome' } },
         } as any),
      ).rejects.toThrow(BadRequestException);
   });
});
