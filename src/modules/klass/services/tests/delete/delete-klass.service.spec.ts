jest.mock('winston-logsene', () => jest.fn());

import { NotFoundException } from '@nestjs/common';
import { AclScopeType, RoleEnum } from '../../../../../../.prisma/client';
import { DeleteKlassService } from '../../delete/delete-klass.service';

describe('DeleteKlassService', () => {
   let prisma: {
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
   };
   let scopedAccessService: {
      assertPermission: jest.Mock;
   };
   let service: DeleteKlassService;

   beforeEach(() => {
      prisma = {
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
      };
      scopedAccessService = {
         assertPermission: jest.fn(),
      };

      service = new DeleteKlassService(
         prisma as any,
         logger as any,
         rules as any,
         scopedAccessService as any,
      );
   });

   it('deve inativar turma ativa', async () => {
      prisma.klass.findUnique.mockResolvedValue({
         id: 'klass-1',
         isActive: true,
      });
      prisma.klass.update.mockResolvedValue({
         id: 'klass-1',
         isActive: false,
      });

      const result = await service.run(
         { where: { id: 'klass-1' } } as any,
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(scopedAccessService.assertPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         permissionCode: 'klass.delete',
         scopeType: AclScopeType.klass,
         scopeId: 'klass-1',
      });
      expect(prisma.klass.update).toHaveBeenCalledWith({
         where: { id: 'klass-1' },
         data: { isActive: false },
      });
      expect(result).toEqual({ id: 'klass-1', isActive: false });
   });

   it('deve retornar registro atual quando turma ja estiver inativa', async () => {
      prisma.klass.findUnique.mockResolvedValue({
         id: 'klass-1',
         isActive: false,
      });

      const result = await service.run({ where: { id: 'klass-1' } } as any);

      expect(prisma.klass.update).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'klass-1', isActive: false });
   });

   it('deve falhar quando turma nao existe', async () => {
      prisma.klass.findUnique.mockResolvedValue(null);

      await expect(
         service.run({ where: { id: 'klass-404' } } as any),
      ).rejects.toThrow(NotFoundException);
   });
});
