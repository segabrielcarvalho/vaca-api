import { UnauthorizedException } from '@nestjs/common';
import { VerifyInviteEmailCodeService } from '../../invite/verify-invite-email-code.service';

describe('VerifyInviteEmailCodeService', () => {
   let challengeService: {
      findById: jest.Mock;
      verifyChallengeCode: jest.Mock;
   };
   let consumeInviteChallengeService: { run: jest.Mock };
   let service: VerifyInviteEmailCodeService;

   beforeEach(() => {
      challengeService = {
         findById: jest.fn(),
         verifyChallengeCode: jest.fn(),
      };
      consumeInviteChallengeService = { run: jest.fn() };

      service = new VerifyInviteEmailCodeService(
         challengeService as any,
         consumeInviteChallengeService as any,
      );
   });

   it('deve consumir o desafio e retornar o contextId quando o codigo e valido', async () => {
      challengeService.findById.mockResolvedValue({ id: 'challenge-1' });
      challengeService.verifyChallengeCode.mockResolvedValue(true);
      consumeInviteChallengeService.run.mockResolvedValue({
         contextId: 'context-1',
         expiresAt: new Date('2026-04-05T12:30:00.000Z'),
      });

      const result = await service.run({
         challengeId: 'challenge-1',
         code: '123456',
      });

      expect(challengeService.findById).toHaveBeenCalledWith({
         id: 'challenge-1',
         type: 'invite_email',
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

   it('deve falhar quando o codigo for invalido', async () => {
      challengeService.findById.mockResolvedValue({ id: 'challenge-1' });
      challengeService.verifyChallengeCode.mockResolvedValue(false);

      await expect(
         service.run({
            challengeId: 'challenge-1',
            code: '000000',
         }),
      ).rejects.toThrow(UnauthorizedException);
   });
});
