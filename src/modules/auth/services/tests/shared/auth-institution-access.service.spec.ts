import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { RoleEnum } from '../../../../../../.prisma/client';
import { AuthInstitutionAccessService } from '../../shared/auth-institution-access.service';

describe('AuthInstitutionAccessService', () => {
   let prisma: {
      school: { findUnique: jest.Mock };
      agent: { findUnique: jest.Mock };
      aclMembership: { findFirst: jest.Mock };
      course: { findFirst: jest.Mock };
      klass: { findFirst: jest.Mock };
   };
   let service: AuthInstitutionAccessService;

   beforeEach(() => {
      prisma = {
         school: { findUnique: jest.fn() },
         agent: { findUnique: jest.fn() },
         aclMembership: { findFirst: jest.fn() },
         course: { findFirst: jest.fn() },
         klass: { findFirst: jest.fn() },
      };

      service = new AuthInstitutionAccessService(prisma as any);
   });

   it('deve normalizar codigo institucional para uppercase alfanumerico', () => {
      expect(service.normalizeInstitutionCode(' vaca123 ')).toBe('VACA123');
   });

   it('deve falhar no start quando codigo institucional e invalido', async () => {
      await expect(
         service.assertStartAccess({
            institutionCode: 'VACA-123',
            userId: 'user-1',
            role: RoleEnum.user,
         }),
      ).rejects.toThrow(BadRequestException);
   });

   it('deve permitir start para admin sem validar membership', async () => {
      prisma.school.findUnique.mockResolvedValue({
         id: 'school-1',
         institutionCode: 'VACADEV',
         isActive: true,
      });

      const school = await service.assertStartAccess({
         institutionCode: 'vacadev',
         userId: 'user-admin',
         role: RoleEnum.admin,
      });

      expect(school.id).toBe('school-1');
      expect(prisma.agent.findUnique).not.toHaveBeenCalled();
   });

   it('deve falhar no start quando user nao possui Agent', async () => {
      prisma.school.findUnique.mockResolvedValue({
         id: 'school-1',
         institutionCode: 'VACADEV',
         isActive: true,
      });
      prisma.agent.findUnique.mockResolvedValue(null);

      await expect(
         service.assertStartAccess({
            institutionCode: 'VACADEV',
            userId: 'user-1',
            role: RoleEnum.user,
         }),
      ).rejects.toThrow(BadRequestException);
   });

   it('deve falhar no challenge quando contexto da school e invalido', async () => {
      await expect(
         service.assertChallengeAccess({
            schoolId: null,
            userId: 'user-1',
            role: RoleEnum.user,
         }),
      ).rejects.toThrow(UnauthorizedException);
   });
});
