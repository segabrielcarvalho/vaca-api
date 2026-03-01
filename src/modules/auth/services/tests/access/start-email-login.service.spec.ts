import { BadRequestException } from '@nestjs/common';
import { RoleEnum } from '../../../../../../.prisma/client';
import { StartEmailLoginService } from '../../access/start-email-login.service';

jest.mock('../../../../email/templates/render-hbs-template', () => ({
   renderHbsTemplate: jest.fn(() => '<html />'),
}));

jest.mock('../../../../email/templates/template-asset.util', () => ({
   getTemplateAssetBase64: jest.fn(() => 'base64-logo'),
}));

describe('StartEmailLoginService', () => {
   let prisma: {
      user: { findUnique: jest.Mock };
   };
   let challengeService: {
      assertRateLimit: jest.Mock;
      getChallengeExpiration: jest.Mock;
      createChallenge: jest.Mock;
   };
   let emailQueueService: { run: jest.Mock };
   let auditService: { run: jest.Mock };
   let authInstitutionAccessService: { assertStartAccess: jest.Mock };
   let service: StartEmailLoginService;

   beforeEach(() => {
      prisma = {
         user: { findUnique: jest.fn() },
      };
      challengeService = {
         assertRateLimit: jest.fn(),
         getChallengeExpiration: jest.fn(
            () => new Date('2030-01-01T00:00:00.000Z'),
         ),
         createChallenge: jest.fn().mockResolvedValue({ id: 'challenge-1' }),
      };
      emailQueueService = { run: jest.fn() };
      auditService = { run: jest.fn() };
      authInstitutionAccessService = {
         assertStartAccess: jest.fn(),
      };

      service = new StartEmailLoginService(
         prisma as any,
         challengeService as any,
         emailQueueService as any,
         auditService as any,
         authInstitutionAccessService as any,
         {
            challenge: {
               maxAttempts: 5,
               ttlMinutes: 10,
            },
         } as any,
         {
            baseAdminUrl: 'https://admin.vaca.local',
            baseWebUrl: 'https://vaca.local',
         } as any,
      );
   });

   it('deve incluir schoolId e institutionCode no payload do challenge', async () => {
      prisma.user.findUnique.mockResolvedValue({
         id: 'user-1',
         role: RoleEnum.user,
         Profile: { name: 'Ana Silva' },
      });
      authInstitutionAccessService.assertStartAccess.mockResolvedValue({
         id: 'school-1',
         institutionCode: 'VACADEV',
         isActive: true,
      });

      const result = await service.run({
         email: 'ana@vaca.dev',
         institutionCode: 'vacadev',
         channel: 'web_admin' as any,
         deviceId: 'device-1',
      });

      expect(authInstitutionAccessService.assertStartAccess).toHaveBeenCalled();
      expect(challengeService.createChallenge).toHaveBeenCalledWith(
         expect.objectContaining({
            payload: expect.objectContaining({
               schoolId: 'school-1',
               institutionCode: 'VACADEV',
            }),
         }),
      );
      expect(result.challengeId).toBe('challenge-1');
   });

   it('deve falhar quando e-mail nao existir', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
         service.run({
            email: 'naoexiste@vaca.dev',
            institutionCode: 'VACADEV',
            channel: 'web_admin' as any,
            deviceId: 'device-1',
         }),
      ).rejects.toThrow(BadRequestException);
   });
});
