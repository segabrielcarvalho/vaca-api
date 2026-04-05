jest.mock('winston-logsene', () => jest.fn());

import { ForbiddenException } from '@nestjs/common';
import { RoleEnum } from '../../../../../../.prisma/client';
import { ListKlassesService } from '../../list/klass.service';

const adminUser = {
   id: 'user-admin',
   role: RoleEnum.admin,
   selectedSchoolId: 'school-1',
};
const regularUser = {
   id: 'user-1',
   role: RoleEnum.user,
   selectedSchoolId: 'school-1',
};

describe('ListKlassesService', () => {
   let prisma: {
      klass: {
         count: jest.Mock;
         findMany: jest.Mock;
      };
   };
   let logger: {
      setContext: jest.Mock;
      debug: jest.Mock;
      log: jest.Mock;
   };
   let rules: { applyDefaultActiveFilter: jest.Mock };
   let scopedAccess: { hasPermission: jest.Mock };
   let service: ListKlassesService;

   beforeEach(() => {
      prisma = {
         klass: {
            count: jest.fn(),
            findMany: jest.fn(),
         },
      };
      logger = {
         setContext: jest.fn(),
         debug: jest.fn(),
         log: jest.fn(),
      };
      rules = {
         applyDefaultActiveFilter: jest
            .fn()
            .mockReturnValue({ isActive: { equals: true } }),
      };
      scopedAccess = {
         hasPermission: jest.fn(),
      };

      service = new ListKlassesService(
         prisma as any,
         logger as any,
         rules as any,
         scopedAccess as any,
      );
   });

   it('deve aplicar filtro padrao de ativos e retornar rows para admin', async () => {
      prisma.klass.count.mockResolvedValue(2);
      prisma.klass.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);

      const result = await service.run(
         {
            where: { name: { equals: 'Alpha' } },
            take: 10,
         } as any,
         adminUser as any,
      );

      expect(rules.applyDefaultActiveFilter).toHaveBeenCalledWith({
         name: { equals: 'Alpha' },
      });
      expect(prisma.klass.count).toHaveBeenCalledWith({
         where: { isActive: { equals: true } },
      });
      expect(prisma.klass.findMany).toHaveBeenCalledWith({
         where: { isActive: { equals: true } },
         take: 10,
      });
      expect(result).toEqual({
         count: 2,
         rows: [{ id: 'c1' }, { id: 'c2' }],
      });
   });

   it('deve listar apenas turmas acessiveis na escola selecionada para usuario comum', async () => {
      prisma.klass.findMany.mockResolvedValue([
         { id: 'klass-1', name: 'Alpha' },
         { id: 'klass-2', name: 'Beta' },
      ]);
      scopedAccess.hasPermission
         .mockResolvedValueOnce(true)
         .mockResolvedValueOnce(false);

      const result = await service.run(
         {
            where: { name: { contains: 'a' } },
            orderBy: [{ name: 'asc' }],
         } as any,
         regularUser as any,
      );

      expect(prisma.klass.findMany).toHaveBeenCalledWith({
         where: {
            AND: [
               { isActive: { equals: true } },
               { Course: { schoolId: 'school-1' } },
            ],
         },
         orderBy: [{ name: 'asc' }],
         cursor: undefined,
         skip: undefined,
         take: undefined,
      });
      expect(scopedAccess.hasPermission).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
         count: 1,
         rows: [{ id: 'klass-1', name: 'Alpha' }],
      });
   });

   it('deve falhar quando usuario comum nao tem escola selecionada', async () => {
      await expect(
         service.run(
            {
               where: { isActive: { equals: true } },
            } as any,
            { id: 'user-1', role: RoleEnum.user } as any,
         ),
      ).rejects.toThrow(ForbiddenException);
   });
});
