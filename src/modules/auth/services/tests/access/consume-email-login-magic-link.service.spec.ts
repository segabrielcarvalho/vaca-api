import { RoleEnum } from '../../../../../../.prisma/client';
import { ConsumeEmailLoginMagicLinkService } from '../../access/consume-email-login-magic-link.service';

describe('ConsumeEmailLoginMagicLinkService', () => {
   let prisma: {
      user: { findUnique: jest.Mock };
      authDevice: { upsert: jest.Mock };
   };
   let challengeService: {
      findByTokenHash: jest.Mock;
      assertChallengeActive: jest.Mock;
      getChallengePayload: jest.Mock;
      consumeChallenge: jest.Mock;
   };
   let sessionService: { run: jest.Mock };
   let auditService: { run: jest.Mock };
   let assertChallengeChannelBindingService: { run: jest.Mock };
   let authInstitutionAccessService: { assertChallengeAccess: jest.Mock };
   let service: ConsumeEmailLoginMagicLinkService;

   beforeEach(() => {
      prisma = {
         user: { findUnique: jest.fn() },
         authDevice: { upsert: jest.fn() },
      };
      challengeService = {
         findByTokenHash: jest.fn(),
         assertChallengeActive: jest.fn(),
         getChallengePayload: jest.fn(),
         consumeChallenge: jest.fn(),
      };
      sessionService = { run: jest.fn() };
      auditService = { run: jest.fn() };
      assertChallengeChannelBindingService = { run: jest.fn() };
      authInstitutionAccessService = { assertChallengeAccess: jest.fn() };

      service = new ConsumeEmailLoginMagicLinkService(
         prisma as any,
         challengeService as any,
         sessionService as any,
         auditService as any,
         assertChallengeChannelBindingService as any,
         authInstitutionAccessService as any,
      );
   });

   it('deve emitir sessao com selectedSchoolId apos consumo do magic link', async () => {
      challengeService.findByTokenHash.mockResolvedValue({
         id: 'challenge-1',
         channel: 'web_admin',
         userId: 'user-1',
      });
      challengeService.getChallengePayload.mockReturnValue({
         deviceId: 'device-1',
         schoolId: 'school-1',
         institutionCode: 'VACADEV',
      });
      prisma.user.findUnique.mockResolvedValue({
         id: 'user-1',
         role: RoleEnum.user,
      });
      authInstitutionAccessService.assertChallengeAccess.mockResolvedValue({
         id: 'school-1',
      });
      prisma.authDevice.upsert.mockResolvedValue({ id: 'auth-device-1' });
      sessionService.run.mockResolvedValue({
         session: { sessionId: 'session-1' },
      });

      await service.run(
         {
            token: 'magic-token',
            channel: 'web_admin' as any,
            deviceId: 'device-1',
         },
         { userAgent: 'jest' },
      );

      expect(
         authInstitutionAccessService.assertChallengeAccess,
      ).toHaveBeenCalledWith(
         expect.objectContaining({
            schoolId: 'school-1',
            institutionCode: 'VACADEV',
            userId: 'user-1',
         }),
      );
      expect(sessionService.run).toHaveBeenCalledWith(
         expect.objectContaining({
            userId: 'user-1',
            selectedSchoolId: 'school-1',
         }),
      );
   });
});
