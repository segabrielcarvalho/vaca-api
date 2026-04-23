jest.mock('winston-logsene', () => jest.fn());

import { BadRequestException } from '@nestjs/common';
import { RoleEnum } from '../../../../../../.prisma/client';
import { CreateSchoolService } from '../../create/create-school.service';

describe('CreateSchoolService', () => {
   let prisma: {
      school: { create: jest.Mock };
      aclRole: { findUnique: jest.Mock };
      agent: { findUnique: jest.Mock };
      aclMembership: { upsert: jest.Mock };
   };
   let logger: {
      setContext: jest.Mock;
      debug: jest.Mock;
      log: jest.Mock;
   };
   let rules: {
      detectUnsupportedNestedOperations: jest.Mock;
      normalizeName: jest.Mock;
      normalizeOptional: jest.Mock;
      normalizeBrandingPath: jest.Mock;
      normalizeHexColor: jest.Mock;
      assertActiveNameUniqueness: jest.Mock;
      assertInstitutionCodeUniqueness: jest.Mock;
      generateUniqueInstitutionCode: jest.Mock;
      normalizeInstitutionCode: jest.Mock;
   };
   let service: CreateSchoolService;

   beforeEach(() => {
      prisma = {
         school: { create: jest.fn() },
         aclRole: { findUnique: jest.fn() },
         agent: { findUnique: jest.fn() },
         aclMembership: { upsert: jest.fn() },
      };
      logger = {
         setContext: jest.fn(),
         debug: jest.fn(),
         log: jest.fn(),
      };
      rules = {
         detectUnsupportedNestedOperations: jest.fn(),
         normalizeName: jest.fn(),
         normalizeOptional: jest.fn(),
         normalizeBrandingPath: jest.fn(),
         normalizeHexColor: jest.fn(),
         assertActiveNameUniqueness: jest.fn(),
         assertInstitutionCodeUniqueness: jest.fn(),
         generateUniqueInstitutionCode: jest.fn(),
         normalizeInstitutionCode: jest.fn(),
      };

      service = new CreateSchoolService(
         prisma as any,
         logger as any,
         rules as any,
      );
   });

   it('deve criar escola com payload saneado e atribuir owner ao criador', async () => {
      rules.normalizeName.mockReturnValue('Escola Alpha');
      rules.generateUniqueInstitutionCode.mockResolvedValue('ESCOLAALPHA');
      rules.normalizeOptional
         .mockReturnValueOnce('Descricao curta')
         .mockReturnValueOnce(null);
      rules.normalizeBrandingPath
         .mockReturnValueOnce(null)
         .mockReturnValueOnce(undefined)
         .mockReturnValueOnce(undefined)
         .mockReturnValueOnce(undefined);
      rules.normalizeHexColor
         .mockReturnValueOnce(undefined)
         .mockReturnValueOnce(undefined);
      prisma.school.create.mockResolvedValue({ id: 'school-1' });
      prisma.aclRole.findUnique.mockResolvedValue({ id: 'role-school-owner' });
      prisma.agent.findUnique.mockResolvedValue({ id: 'agent-1' });

      const result = await service.run(
         {
            data: {
               name: '  Escola  Alpha  ',
               description: '  Descricao curta  ',
               bannerPath: ' ',
            },
         } as any,
         { id: 'user-1', role: RoleEnum.admin } as any,
      );

      expect(rules.assertActiveNameUniqueness).toHaveBeenCalledWith(
         'Escola Alpha',
      );
      expect(rules.generateUniqueInstitutionCode).toHaveBeenCalledWith(
         'Escola Alpha',
      );
      expect(rules.normalizeInstitutionCode).not.toHaveBeenCalled();
      expect(rules.assertInstitutionCodeUniqueness).not.toHaveBeenCalled();
      expect(prisma.school.create).toHaveBeenCalledWith({
         data: {
            name: 'Escola Alpha',
            institutionCode: 'ESCOLAALPHA',
            description: 'Descricao curta',
            bannerPath: null,
            primaryColor: '#FACC15',
            secondaryColor: '#000000',
            isActive: true,
         },
      });
      expect(prisma.aclMembership.upsert).toHaveBeenCalledWith({
         where: {
            schoolId_agentId: {
               schoolId: 'school-1',
               agentId: 'agent-1',
            },
         },
         update: { roleId: 'role-school-owner' },
         create: {
            schoolId: 'school-1',
            agentId: 'agent-1',
            roleId: 'role-school-owner',
         },
      });
      expect(result).toEqual({ id: 'school-1' });
   });

   it('deve criar escola usando institutionCode manual normalizado', async () => {
      rules.normalizeName.mockReturnValue('Escola Alpha');
      rules.normalizeInstitutionCode.mockReturnValue('ALPHA01');
      rules.normalizeOptional.mockReturnValue(undefined);
      rules.normalizeBrandingPath.mockReturnValue(undefined);
      rules.normalizeHexColor
         .mockReturnValueOnce(undefined)
         .mockReturnValueOnce(undefined);
      prisma.school.create.mockResolvedValue({ id: 'school-1' });
      prisma.aclRole.findUnique.mockResolvedValue({ id: 'role-school-owner' });
      prisma.agent.findUnique.mockResolvedValue({ id: 'agent-1' });

      await service.run(
         {
            data: {
               name: 'Escola Alpha',
               institutionCode: ' alpha-01 ',
            },
         } as any,
         { id: 'user-1', role: RoleEnum.admin } as any,
      );

      expect(rules.generateUniqueInstitutionCode).not.toHaveBeenCalled();
      expect(rules.normalizeInstitutionCode).toHaveBeenCalledWith(' alpha-01 ');
      expect(rules.assertInstitutionCodeUniqueness).toHaveBeenCalledWith(
         'ALPHA01',
      );
      expect(prisma.school.create).toHaveBeenCalledWith({
         data: {
            name: 'Escola Alpha',
            institutionCode: 'ALPHA01',
            primaryColor: '#FACC15',
            secondaryColor: '#000000',
            isActive: true,
         },
      });
   });

   it('deve falhar quando usuario nao possuir Agent para ownership', async () => {
      rules.normalizeName.mockReturnValue('Escola Alpha');
      rules.generateUniqueInstitutionCode.mockResolvedValue('ESCOLAALPHA');
      rules.normalizeOptional.mockReturnValue(undefined);
      rules.normalizeBrandingPath.mockReturnValue(undefined);
      rules.normalizeHexColor
         .mockReturnValueOnce(undefined)
         .mockReturnValueOnce(undefined);
      prisma.school.create.mockResolvedValue({ id: 'school-1' });
      prisma.aclRole.findUnique.mockResolvedValue({ id: 'role-school-owner' });
      prisma.agent.findUnique.mockResolvedValue(null);

      await expect(
         service.run(
            {
               data: {
                  name: 'Escola Alpha',
               },
            } as any,
            { id: 'user-1', role: RoleEnum.admin } as any,
         ),
      ).rejects.toThrow(BadRequestException);
   });
});
