import { ForbiddenException } from '@nestjs/common';
import { RoleEnum } from '../../../../../../.prisma/client';
import { ListCourseOmrTemplatesService } from '../../list/list-course-omr-templates.service';

describe('ListCourseOmrTemplatesService', () => {
   let prisma: {
      klass: {
         findMany: jest.Mock;
      };
      omrTemplate: {
         count: jest.Mock;
         findMany: jest.Mock;
      };
   };
   let scopedAccessService: {
      assertPermission: jest.Mock;
   };
   let service: ListCourseOmrTemplatesService;

   beforeEach(() => {
      prisma = {
         klass: {
            findMany: jest.fn().mockResolvedValue([]),
         },
         omrTemplate: {
            count: jest.fn().mockResolvedValue(1),
            findMany: jest.fn().mockResolvedValue([{ id: 'template-1' }]),
         },
      };
      scopedAccessService = {
         assertPermission: jest.fn(),
      };

      service = new ListCourseOmrTemplatesService(
         prisma as any,
         scopedAccessService as any,
      );
   });

   it('deve permitir listagem com permissao de curso', async () => {
      scopedAccessService.assertPermission.mockResolvedValue(undefined);

      const result = await service.run(
         {
            courseId: 'course-1',
            skip: 0,
            take: 20,
         },
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(scopedAccessService.assertPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         permissionCode: 'course.template.read',
         scopeType: 'course',
         scopeId: 'course-1',
      });
      expect(prisma.klass.findMany).not.toHaveBeenCalled();
      expect(prisma.omrTemplate.count).toHaveBeenCalled();
      expect(prisma.omrTemplate.findMany).toHaveBeenCalled();
      expect(result).toEqual({
         count: 1,
         rows: [{ id: 'template-1' }],
      });
   });

   it('deve permitir listagem via fallback de turma quando curso negar', async () => {
      scopedAccessService.assertPermission.mockImplementation(
         ({ scopeType, scopeId }) => {
            if (scopeType === 'course') {
               return Promise.reject(new ForbiddenException('Acesso negado'));
            }

            if (scopeType === 'klass' && scopeId === 'klass-2') {
               return Promise.resolve(undefined);
            }

            return Promise.reject(new ForbiddenException('Acesso negado'));
         },
      );
      prisma.klass.findMany.mockResolvedValue([
         { id: 'klass-1' },
         { id: 'klass-2' },
      ]);

      const result = await service.run(
         {
            courseId: 'course-1',
         },
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(prisma.klass.findMany).toHaveBeenCalledWith({
         where: {
            courseId: 'course-1',
            isActive: true,
         },
         select: { id: true },
      });
      expect(scopedAccessService.assertPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         permissionCode: 'klass.exam.manage',
         scopeType: 'klass',
         scopeId: 'klass-1',
      });
      expect(scopedAccessService.assertPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         permissionCode: 'klass.exam.manage',
         scopeType: 'klass',
         scopeId: 'klass-2',
      });
      expect(prisma.omrTemplate.count).toHaveBeenCalled();
      expect(prisma.omrTemplate.findMany).toHaveBeenCalled();
      expect(result).toEqual({
         count: 1,
         rows: [{ id: 'template-1' }],
      });
   });

   it('deve negar quando nao houver permissao de curso nem de turma', async () => {
      scopedAccessService.assertPermission.mockImplementation(() => {
         return Promise.reject(new ForbiddenException('Acesso negado'));
      });
      prisma.klass.findMany.mockResolvedValue([{ id: 'klass-1' }]);

      await expect(
         service.run(
            {
               courseId: 'course-1',
            },
            { id: 'user-1', role: RoleEnum.user } as any,
         ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.omrTemplate.count).not.toHaveBeenCalled();
      expect(prisma.omrTemplate.findMany).not.toHaveBeenCalled();
   });
});
