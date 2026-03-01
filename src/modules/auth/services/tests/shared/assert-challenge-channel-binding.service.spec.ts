import { UnauthorizedException } from '@nestjs/common';
import { AuthChannelEnum } from '../../../../../../.prisma/client';
import { AssertChallengeChannelBindingService } from '../../shared/assert-challenge-channel-binding.service';

describe('AssertChallengeChannelBindingService', () => {
   let service: AssertChallengeChannelBindingService;

   beforeEach(() => {
      service = new AssertChallengeChannelBindingService();
   });

   it('deve aceitar quando challenge e input estao no mesmo canal', () => {
      expect(() =>
         service.run({
            challengeChannel: AuthChannelEnum.web_admin,
            inputChannel: AuthChannelEnum.web_admin,
         }),
      ).not.toThrow();
   });

   it('deve bloquear quando challenge e input estao em canais diferentes', () => {
      expect(() =>
         service.run({
            challengeChannel: AuthChannelEnum.web_admin,
            inputChannel: AuthChannelEnum.expo_mobile,
         }),
      ).toThrow(UnauthorizedException);
   });
});
