import { AuthChallengeTypeEnum } from '../../../../../../.prisma/client';
import { StartInviteAcceptanceService } from '../../invite/start-invite-acceptance.service';

describe('StartInviteAcceptanceService', () => {
   let challengeService: {
      assertRateLimit: jest.Mock;
      getChallengeExpiration: jest.Mock;
      createChallenge: jest.Mock;
   };
   let getActiveInviteByTokenService: { run: jest.Mock };
   let emailQueueService: { run: jest.Mock };
   let auditService: { run: jest.Mock };
   let service: StartInviteAcceptanceService;

   beforeEach(() => {
      challengeService = {
         assertRateLimit: jest.fn(),
         getChallengeExpiration: jest.fn(),
         createChallenge: jest.fn(),
      };
      getActiveInviteByTokenService = { run: jest.fn() };
      emailQueueService = { run: jest.fn() };
      auditService = { run: jest.fn() };

      service = new StartInviteAcceptanceService(
         challengeService as any,
         getActiveInviteByTokenService as any,
         emailQueueService as any,
         auditService as any,
         {
            challenge: {
               ttlMinutes: 15,
               maxAttempts: 5,
            },
         } as any,
         {
            baseAdminUrl: 'https://app.vaca.dev',
            baseWebUrl: 'https://web.vaca.dev',
         } as any,
      );
   });

   it('deve criar o desafio e enviar e-mail de verificacao com link de convite', async () => {
      const expiresAt = new Date('2026-04-05T12:00:00.000Z');

      getActiveInviteByTokenService.run.mockResolvedValue({
         id: 'invite-1',
         email: 'teacher@vaca.dev',
         userId: 'user-1',
      });
      challengeService.getChallengeExpiration.mockReturnValue(expiresAt);
      challengeService.createChallenge.mockResolvedValue({
         id: 'challenge-1',
      });

      const result = await service.run(
         {
            inviteToken: 'raw-invite-token',
            channel: 'web_admin' as any,
         },
         { ip: '127.0.0.1' },
      );

      expect(getActiveInviteByTokenService.run).toHaveBeenCalledWith(
         'raw-invite-token',
      );
      expect(challengeService.assertRateLimit).toHaveBeenCalledWith({
         email: 'teacher@vaca.dev',
         type: AuthChallengeTypeEnum.invite_email,
         ip: '127.0.0.1',
      });
      expect(challengeService.createChallenge).toHaveBeenCalledWith(
         expect.objectContaining({
            type: AuthChallengeTypeEnum.invite_email,
            inviteId: 'invite-1',
            email: 'teacher@vaca.dev',
            userId: 'user-1',
         }),
      );
      expect(emailQueueService.run).toHaveBeenCalledWith(
         expect.objectContaining({
            to: 'teacher@vaca.dev',
            html: expect.stringContaining('/auth/invite/verify?token'),
         }),
      );
      expect(result).toEqual({
         challengeId: 'challenge-1',
         maskedEmail: 'te***@vaca.dev',
         expiresAt,
      });
   });
});
