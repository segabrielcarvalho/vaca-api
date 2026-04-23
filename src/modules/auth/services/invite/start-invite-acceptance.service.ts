import {
   AuthAuditEventTypeEnum,
   AuthChallengeTypeEnum,
   AuthChannelEnum as PrismaAuthChannelEnum,
   Prisma,
} from '../../../../../.prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../../app/app.config';
import { renderHbsTemplate } from '../../../email/templates/render-hbs-template';
import { getTemplateAssetBase64 } from '../../../email/templates/template-asset.util';
import authConfig from '../../auth.config';
import { AUTH_EMAIL_SUBJECT } from '../../auth.constants';
import type { StartInviteAcceptanceInput } from '../../input';
import type { InviteAcceptanceStart } from '../../objects';
import {
   createTokenHash,
   generateOtpCode,
   generateRandomToken,
   maskEmail,
} from '../../utils/auth-crypto.util';
import { buildAuthFrontendLink } from '../../utils/auth-link.util';
import { AuthAuditService } from '../shared/auth-audit.service';
import { AuthChallengeService } from '../shared/auth-challenge.service';
import { AuthEmailQueueService } from '../shared/auth-email-queue.service';
import { GetActiveInviteByTokenService } from '../shared/get-active-invite-by-token.service';
import type { RequestMeta } from '../auth-context.service';

type StartInviteAcceptanceOptions = {
   requestOrigin?: string;
};

@Injectable()
export class StartInviteAcceptanceService {
   constructor(
      private readonly challengeService: AuthChallengeService,
      private readonly getActiveInviteByTokenService: GetActiveInviteByTokenService,
      private readonly emailQueueService: AuthEmailQueueService,
      private readonly auditService: AuthAuditService,
      @Inject(authConfig.KEY)
      private readonly auth: ConfigType<typeof authConfig>,
      @Inject(appConfig.KEY)
      private readonly app: ConfigType<typeof appConfig>,
   ) {}

   async run(
      input: StartInviteAcceptanceInput,
      meta?: RequestMeta,
      options?: StartInviteAcceptanceOptions,
   ): Promise<InviteAcceptanceStart> {
      const invite = await this.getActiveInviteByTokenService.run(
         input.inviteToken,
      );

      await this.challengeService.assertRateLimit({
         email: invite.email,
         type: AuthChallengeTypeEnum.invite_email,
         ip: meta?.ip,
      });

      const code = generateOtpCode();
      const magicToken = generateRandomToken(40);
      const expiresAt = this.challengeService.getChallengeExpiration();

      const challenge = await this.challengeService.createChallenge({
         type: AuthChallengeTypeEnum.invite_email,
         channel: input.channel as PrismaAuthChannelEnum,
         email: invite.email,
         codeHash: createTokenHash(code),
         tokenHash: createTokenHash(magicToken),
         userId: invite.userId ?? undefined,
         inviteId: invite.id,
         maxAttempts: this.auth.challenge.maxAttempts,
         expiresAt,
         payload: {
            mode: 'invite_acceptance',
         },
      });

      const inviteVerifyLink = buildAuthFrontendLink({
         baseWebUrl: this.app.baseWebUrl,
         requestOrigin: options?.requestOrigin,
         path: '/auth/invite/verify',
         query: { token: magicToken },
      });
      const logoBase64 = getTemplateAssetBase64(
         'logo-vaca-completa-branca.png',
      );

      await this.emailQueueService.run({
         to: invite.email,
         subject: AUTH_EMAIL_SUBJECT.INVITE_VERIFICATION,
         html: renderHbsTemplate('auth-invite-verification', {
            code,
            verifyLink: inviteVerifyLink,
            challengeTtlMinutes: this.auth.challenge.ttlMinutes,
            appName: 'VACA',
            logoBase64,
         }),
      });

      await this.auditService.run({
         userId: invite.userId ?? undefined,
         eventType: AuthAuditEventTypeEnum.invite_started,
         channel: input.channel as PrismaAuthChannelEnum,
         metadata: {
            inviteId: invite.id,
            email: invite.email,
         } as Prisma.InputJsonValue,
      });

      return {
         challengeId: challenge.id,
         maskedEmail: maskEmail(invite.email),
         expiresAt,
      };
   }
}
