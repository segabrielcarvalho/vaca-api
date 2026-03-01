jest.mock('winston-logsene', () => jest.fn());

import { BadRequestException } from '@nestjs/common';
import { AclScopeType, RoleEnum } from '../../../../../../.prisma/client';
import { UpdateSchoolService } from '../../update/update-school.service';

describe('UpdateSchoolService', () => {
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
      detectUnsupportedNestedOperations: jest.Mock;
      normalizeName: jest.Mock;
      normalizeOptional: jest.Mock;
      assertActiveNameUniqueness: jest.Mock;
   };
   let scopedAccessService: {
      assertPermission: jest.Mock;
   };
   let service: UpdateSchoolService;

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
         detectUnsupportedNestedOperations: jest.fn(),
         normalizeName: jest.fn(),
         normalizeOptional: jest.fn(),
         assertActiveNameUniqueness: jest.fn(),
      };
      scopedAccessService = {
         assertPermission: jest.fn(),
      };

      service = new UpdateSchoolService(
         prisma as any,
         logger as any,
         rules as any,
         scopedAccessService as any,
      );
   });

   it('deve atualizar escola ativa com campos permitidos', async () => {
      prisma.school.findUnique.mockResolvedValue({
         id: 'school-1',
         isActive: true,
         name: 'Atual',
      });
      rules.normalizeName.mockReturnValue('Novo Nome');
      prisma.school.update.mockResolvedValue({
         id: 'school-1',
         name: 'Novo Nome',
      });

      const result = await service.run(
         {
            where: { id: 'school-1' },
            data: {
               name: { set: ' Novo Nome ' },
            },
         } as any,
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(scopedAccessService.assertPermission).toHaveBeenCalledWith({
         user: { id: 'user-1', role: RoleEnum.user },
         permissionCode: 'school.update',
         scopeType: AclScopeType.school,
         scopeId: 'school-1',
      });
      expect(rules.assertActiveNameUniqueness).toHaveBeenCalledWith(
         'Novo Nome',
         'school-1',
      );
      expect(prisma.school.update).toHaveBeenCalledWith({
         where: { id: 'school-1' },
         data: {
            name: 'Novo Nome',
         },
      });
      expect(result).toEqual({ id: 'school-1', name: 'Novo Nome' });
   });

   it('deve bloquear update em escola inativa quando nao for reativacao', async () => {
      prisma.school.findUnique.mockResolvedValue({
         id: 'school-1',
         isActive: false,
         name: 'Escola Inativa',
      });
      rules.normalizeName.mockReturnValue('Outro Nome');

      await expect(
         service.run({
            where: { id: 'school-1' },
            data: { name: { set: 'Outro Nome' } },
         } as any),
      ).rejects.toThrow(BadRequestException);
   });

   it('deve permitir reativacao de escola inativa', async () => {
      prisma.school.findUnique.mockResolvedValue({
         id: 'school-1',
         isActive: false,
         name: 'Escola Inativa',
      });
      prisma.school.update.mockResolvedValue({
         id: 'school-1',
         isActive: true,
      });

      const result = await service.run({
         where: { id: 'school-1' },
         data: { isActive: { set: true } },
      } as any);

      expect(rules.assertActiveNameUniqueness).toHaveBeenCalledWith(
         'Escola Inativa',
         'school-1',
      );
      expect(prisma.school.update).toHaveBeenCalledWith({
         where: { id: 'school-1' },
         data: { isActive: true },
      });
      expect(result).toEqual({ id: 'school-1', isActive: true });
   });

   it('deve rejeitar tentativa de atualizar institutionCode', async () => {
      prisma.school.findUnique.mockResolvedValue({
         id: 'school-1',
         isActive: true,
         name: 'Escola Alpha',
      });

      await expect(
         service.run({
            where: { id: 'school-1' },
            data: { institutionCode: { set: 'NOVOCODIGO' } },
         } as any),
      ).rejects.toThrow(BadRequestException);
   });
});
