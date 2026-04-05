jest.mock('winston-logsene', () => jest.fn());

import { NotFoundException } from '@nestjs/common';
import { RoleEnum } from '../../../../../../.prisma/client';
import { GetSchoolService } from '../../get/get-school.service';

describe('GetSchoolService', () => {
   const adminUser = {
      id: 'user-admin',
      role: RoleEnum.admin,
      selectedSchoolId: 'school-1',
   };
   let prisma: { school: { findFirst: jest.Mock } };
   let logger: {
      setContext: jest.Mock;
      debug: jest.Mock;
      warn: jest.Mock;
   };
   let rules: { extractSchoolId: jest.Mock };
   let service: GetSchoolService;

   beforeEach(() => {
      prisma = { school: { findFirst: jest.fn() } };
      logger = {
         setContext: jest.fn(),
         debug: jest.fn(),
         warn: jest.fn(),
      };
      rules = { extractSchoolId: jest.fn().mockReturnValue('school-1') };

      service = new GetSchoolService(
         prisma as any,
         logger as any,
         rules as any,
      );
   });

   it('deve retornar escola ativa', async () => {
      prisma.school.findFirst.mockResolvedValue({ id: 'school-1' });

      const result = await service.run(
         {
            where: { id: 'school-1' },
         } as any,
         adminUser as any,
      );

      expect(prisma.school.findFirst).toHaveBeenCalledWith({
         where: { id: 'school-1', isActive: true },
      });
      expect(result).toEqual({ id: 'school-1' });
   });

   it('deve falhar quando escola nao existir ou estiver inativa', async () => {
      prisma.school.findFirst.mockResolvedValue(null);

      await expect(
         service.run({ where: { id: 'school-404' } } as any, adminUser as any),
      ).rejects.toThrow(NotFoundException);
   });
});
