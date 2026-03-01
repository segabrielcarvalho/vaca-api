import { AuthChallengeTypeEnum } from '../../../../../.prisma/client';
import { Injectable } from '@nestjs/common';
import type { ConsumeInviteMagicLinkInput } from '../../input';
import type { InviteEmailVerified } from '../../objects';
import { createTokenHash } from '../../utils/auth-crypto.util';
import { AuthChallengeService } from '../shared/auth-challenge.service';
import { ConsumeInviteChallengeService } from '../shared/consume-invite-challenge.service';

@Injectable()
export class ConsumeInviteMagicLinkService {
   constructor(
      private readonly challengeService: AuthChallengeService,
      private readonly consumeInviteChallengeService: ConsumeInviteChallengeService,
   ) {}

   async run(input: ConsumeInviteMagicLinkInput): Promise<InviteEmailVerified> {
      const challenge = await this.challengeService.findByTokenHash({
         type: AuthChallengeTypeEnum.invite_email,
         tokenHash: createTokenHash(input.token),
      });

      this.challengeService.assertChallengeActive(challenge);

      return this.consumeInviteChallengeService.run(challenge.id);
   }
}
