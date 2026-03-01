jest.mock('winston-logsene', () => jest.fn());

import { AclScopeType, RoleEnum } from '../../../../../../.prisma/client';
import { NotFoundException } from '@nestjs/common';
import { DeleteSchoolService } from '../../delete/delete-school.service';

describe('DeleteSchoolService', () => {
   let prisma: {
      school: {
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
      extractSchoolId: jest.Mock;
   };
   let scopedAccessService: {
      assertPermission: jest.Mock;
   };
   let service: DeleteSchoolService;

   beforeEach(() => {
      prisma = {
         school: {
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
         extractSchoolId: jest.fn().mockReturnValue('school-1'),
      };
      scopedAccessService = {
         assertPermission: jest.fn(),
      };

      service = new DeleteSchoolService(
         prisma as any,
         logger as any,
         rules as any,
         scopedAccessService as any,
      );
   });

   it('deve inativar escola ativa', async () => {
      prisma.school.findUnique.mockResolvedValue({
         id: 'school-1',
         isActive: true,
      });
      prisma.school.update.mockResolvedValue({
         id: 'school-1',
         isActive: false,
      });

      const result = await service.run(
         { where: { id: 'school-1' } } as any,
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(scopedAccessService.assertPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         permissionCode: 'school.delete',
         scopeType: AclScopeType.school,
         scopeId: 'school-1',
      });
      expect(prisma.school.update).toHaveBeenCalledWith({
         where: { id: 'school-1' },
         data: { isActive: false },
      });
      expect(result).toEqual({ id: 'school-1', isActive: false });
   });

   it('deve retornar registro atual quando escola ja estiver inativa', async () => {
      prisma.school.findUnique.mockResolvedValue({
         id: 'school-1',
         isActive: false,
      });

      const result = await service.run({ where: { id: 'school-1' } } as any);

      expect(prisma.school.update).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'school-1', isActive: false });
   });

   it('deve falhar quando escola nao existe', async () => {
      prisma.school.findUnique.mockResolvedValue(null);

      await expect(
         service.run({ where: { id: 'school-404' } } as any),
      ).rejects.toThrow(NotFoundException);
   });
});
