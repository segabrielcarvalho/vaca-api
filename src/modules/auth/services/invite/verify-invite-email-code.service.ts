import { AuthChallengeTypeEnum } from '../../../../../.prisma/client';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { VerifyInviteEmailCodeInput } from '../../input';
import type { InviteEmailVerified } from '../../objects';
import { AuthChallengeService } from '../shared/auth-challenge.service';
import { ConsumeInviteChallengeService } from '../shared/consume-invite-challenge.service';

@Injectable()
export class VerifyInviteEmailCodeService {
   constructor(
      private readonly challengeService: AuthChallengeService,
      private readonly consumeInviteChallengeService: ConsumeInviteChallengeService,
   ) {}

   async run(input: VerifyInviteEmailCodeInput): Promise<InviteEmailVerified> {
      const challenge = await this.challengeService.findById({
         id: input.challengeId,
         type: AuthChallengeTypeEnum.invite_email,
      });

      const valid = await this.challengeService.verifyChallengeCode(
         challenge,
         input.code,
      );
      if (!valid) {
         throw new UnauthorizedException('Codigo invalido ou expirado.');
      }

      return this.consumeInviteChallengeService.run(input.challengeId);
   }
}
