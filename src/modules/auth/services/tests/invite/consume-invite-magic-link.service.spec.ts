import { ConsumeInviteMagicLinkService } from '../../invite/consume-invite-magic-link.service';

describe('ConsumeInviteMagicLinkService', () => {
   let challengeService: {
      findByTokenHash: jest.Mock;
      assertChallengeActive: jest.Mock;
   };
   let consumeInviteChallengeService: { run: jest.Mock };
   let service: ConsumeInviteMagicLinkService;

   beforeEach(() => {
      challengeService = {
         findByTokenHash: jest.fn(),
         assertChallengeActive: jest.fn(),
      };
      consumeInviteChallengeService = { run: jest.fn() };

      service = new ConsumeInviteMagicLinkService(
         challengeService as any,
         consumeInviteChallengeService as any,
      );
   });

   it('deve localizar o desafio pelo token e devolver o contextId', async () => {
      challengeService.findByTokenHash.mockResolvedValue({
         id: 'challenge-1',
      });
      consumeInviteChallengeService.run.mockResolvedValue({
         contextId: 'context-1',
         expiresAt: new Date('2026-04-05T12:30:00.000Z'),
      });

      const result = await service.run({
         token: 'magic-token',
      });

      expect(challengeService.findByTokenHash).toHaveBeenCalledWith({
         type: 'invite_email',
         tokenHash: expect.any(String),
      });
      expect(challengeService.assertChallengeActive).toHaveBeenCalledWith({
         id: 'challenge-1',
      });
      expect(consumeInviteChallengeService.run).toHaveBeenCalledWith(
         'challenge-1',
      );
      expect(result).toEqual(
         expect.objectContaining({
            contextId: 'context-1',
         }),
      );
   });
});
