jest.mock('winston-logsene', () => jest.fn());

import { NotFoundException } from '@nestjs/common';
import { AclScopeType, RoleEnum } from '../../../../../../.prisma/client';
import { DeleteCourseService } from '../../delete/delete-course.service';

describe('DeleteCourseService', () => {
   let prisma: {
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
   };
   let scopedAccessService: {
      assertPermission: jest.Mock;
   };
   let service: DeleteCourseService;

   beforeEach(() => {
      prisma = {
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
      };
      scopedAccessService = {
         assertPermission: jest.fn(),
      };

      service = new DeleteCourseService(
         prisma as any,
         logger as any,
         rules as any,
         scopedAccessService as any,
      );
   });

   it('deve inativar curso ativo', async () => {
      prisma.course.findUnique.mockResolvedValue({
         id: 'course-1',
         isActive: true,
      });
      prisma.course.update.mockResolvedValue({
         id: 'course-1',
         isActive: false,
      });

      const result = await service.run(
         { where: { id: 'course-1' } } as any,
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(scopedAccessService.assertPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         permissionCode: 'course.delete',
         scopeType: AclScopeType.course,
         scopeId: 'course-1',
      });
      expect(prisma.course.update).toHaveBeenCalledWith({
         where: { id: 'course-1' },
         data: { isActive: false },
      });
      expect(result).toEqual({ id: 'course-1', isActive: false });
   });

   it('deve retornar registro atual quando curso ja estiver inativo', async () => {
      prisma.course.findUnique.mockResolvedValue({
         id: 'course-1',
         isActive: false,
      });

      const result = await service.run({ where: { id: 'course-1' } } as any);

      expect(prisma.course.update).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'course-1', isActive: false });
   });

   it('deve falhar quando curso nao existe', async () => {
      prisma.course.findUnique.mockResolvedValue(null);

      await expect(
         service.run({ where: { id: 'course-404' } } as any),
      ).rejects.toThrow(NotFoundException);
   });
});
