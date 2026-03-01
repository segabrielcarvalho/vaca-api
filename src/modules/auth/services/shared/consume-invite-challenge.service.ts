import { AuthAuditEventTypeEnum } from '../../../../../.prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AUTH_CONTEXT_SCOPE } from '../../auth.constants';
import type { InviteEmailVerified } from '../../objects';
import { AuthAuditService } from './auth-audit.service';
import { AuthChallengeService } from './auth-challenge.service';
import { AuthContextTokenService } from './auth-context-token.service';

@Injectable()
export class ConsumeInviteChallengeService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly challengeService: AuthChallengeService,
      private readonly contextTokenService: AuthContextTokenService,
      private readonly auditService: AuthAuditService,
   ) {}

   async run(challengeId: string): Promise<InviteEmailVerified> {
      const challenge = await this.challengeService.findById({
         id: challengeId,
      });

      this.challengeService.assertChallengeActive(challenge);

      if (!challenge?.inviteId) {
         throw new BadRequestException(
            'Convite nao encontrado para o desafio.',
         );
      }

      const invite = await this.prisma.authInvite.findUnique({
         where: { id: challenge.inviteId },
      });

      if (!invite || !invite.userId) {
         throw new BadRequestException('Convite invalido para onboarding.');
      }

      await this.challengeService.consumeChallenge(challenge);
      await this.prisma.user.update({
         where: { id: invite.userId },
         data: { verifiedEmail: true },
      });

      const contextExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const contextId = this.contextTokenService.createContextToken(
         {
            scope: AUTH_CONTEXT_SCOPE.INVITE_ONBOARDING,
            userId: invite.userId,
            channel: challenge.channel,
            inviteId: invite.id,
            email: invite.email,
         },
         30 * 60,
      );

      await this.auditService.run({
         userId: invite.userId,
         eventType: AuthAuditEventTypeEnum.invite_verified,
         channel: challenge.channel,
         metadata: { inviteId: invite.id },
      });

      return {
         contextId,
         expiresAt: contextExpiresAt,
      };
   }
}
