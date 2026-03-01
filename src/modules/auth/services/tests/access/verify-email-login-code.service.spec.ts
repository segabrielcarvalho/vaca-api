import { RoleEnum } from '../../../../../../.prisma/client';
import { VerifyEmailLoginCodeService } from '../../access/verify-email-login-code.service';

describe('VerifyEmailLoginCodeService', () => {
   let prisma: {
      user: { findUnique: jest.Mock };
      authDevice: { upsert: jest.Mock };
   };
   let challengeService: {
      findById: jest.Mock;
      assertChallengeActive: jest.Mock;
      verifyChallengeCode: jest.Mock;
      getChallengePayload: jest.Mock;
      consumeChallenge: jest.Mock;
   };
   let sessionService: { run: jest.Mock };
   let auditService: { run: jest.Mock };
   let assertChallengeChannelBindingService: { run: jest.Mock };
   let authInstitutionAccessService: { assertChallengeAccess: jest.Mock };
   let service: VerifyEmailLoginCodeService;

   beforeEach(() => {
      prisma = {
         user: { findUnique: jest.fn() },
         authDevice: { upsert: jest.fn() },
      };
      challengeService = {
         findById: jest.fn(),
         assertChallengeActive: jest.fn(),
         verifyChallengeCode: jest.fn(),
         getChallengePayload: jest.fn(),
         consumeChallenge: jest.fn(),
      };
      sessionService = { run: jest.fn() };
      auditService = { run: jest.fn() };
      assertChallengeChannelBindingService = { run: jest.fn() };
      authInstitutionAccessService = { assertChallengeAccess: jest.fn() };

      service = new VerifyEmailLoginCodeService(
         prisma as any,
         challengeService as any,
         sessionService as any,
         auditService as any,
         assertChallengeChannelBindingService as any,
         authInstitutionAccessService as any,
      );
   });

   it('deve emitir sessao com selectedSchoolId apos revalidar acesso institucional', async () => {
      challengeService.findById.mockResolvedValue({
         id: 'challenge-1',
         channel: 'web_admin',
         email: 'agent@vaca.dev',
         userId: 'user-1',
      });
      challengeService.verifyChallengeCode.mockResolvedValue(true);
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
            challengeId: 'challenge-1',
            code: '123456',
            channel: 'web_admin' as any,
            deviceId: 'device-1',
         },
         { ip: '127.0.0.1' },
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
