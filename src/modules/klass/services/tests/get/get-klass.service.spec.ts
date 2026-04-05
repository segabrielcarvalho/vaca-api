jest.mock('winston-logsene', () => jest.fn());

import { NotFoundException } from '@nestjs/common';
import { RoleEnum } from '../../../../../../.prisma/client';
import { GetKlassService } from '../../get/get-klass.service';

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

describe('GetKlassService', () => {
   let prisma: { klass: { findFirst: jest.Mock } };
   let logger: {
      setContext: jest.Mock;
      debug: jest.Mock;
      warn: jest.Mock;
   };
   let rules: { extractKlassId: jest.Mock };
   let scopedAccess: { assertPermission: jest.Mock };
   let service: GetKlassService;

   beforeEach(() => {
      prisma = { klass: { findFirst: jest.fn() } };
      logger = {
         setContext: jest.fn(),
         debug: jest.fn(),
         warn: jest.fn(),
      };
      rules = { extractKlassId: jest.fn().mockReturnValue('klass-1') };
      scopedAccess = {
         assertPermission: jest.fn().mockResolvedValue(undefined),
      };

      service = new GetKlassService(
         prisma as any,
         logger as any,
         rules as any,
         scopedAccess as any,
      );
   });

   it('deve retornar turma ativa para admin', async () => {
      prisma.klass.findFirst.mockResolvedValue({
         id: 'klass-1',
         Course: { schoolId: 'school-1' },
      });

      const result = await service.run(
         { where: { id: 'klass-1' } } as any,
         adminUser as any,
      );

      expect(result).toMatchObject({ id: 'klass-1' });
      expect(scopedAccess.assertPermission).not.toHaveBeenCalled();
   });

   it('deve retornar turma ativa para usuario com permissao', async () => {
      prisma.klass.findFirst.mockResolvedValue({
         id: 'klass-1',
         Course: { schoolId: 'school-1' },
      });

      const result = await service.run(
         { where: { id: 'klass-1' } } as any,
         regularUser as any,
      );

      expect(result).toMatchObject({ id: 'klass-1' });
      expect(scopedAccess.assertPermission).toHaveBeenCalledWith(
         expect.objectContaining({
            permissionCode: 'klass.exam.read',
            scopeId: 'klass-1',
         }),
      );
   });

   it('deve falhar quando turma nao existir ou estiver inativa', async () => {
      prisma.klass.findFirst.mockResolvedValue(null);

      await expect(
         service.run({ where: { id: 'klass-404' } } as any, regularUser as any),
      ).rejects.toThrow(NotFoundException);
   });

   it('deve falhar quando turma pertencer a outra escola', async () => {
      prisma.klass.findFirst.mockResolvedValue({
         id: 'klass-1',
         Course: { schoolId: 'school-OTHER' },
      });

      await expect(
         service.run({ where: { id: 'klass-1' } } as any, regularUser as any),
      ).rejects.toThrow(NotFoundException);
   });
});
