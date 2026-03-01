import {
   AuthAuditEventTypeEnum,
   AuthChallengeTypeEnum,
   AuthChannelEnum as PrismaAuthChannelEnum,
   Prisma,
} from '../../../../../.prisma/client';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../../app/app.config';
import { renderHbsTemplate } from '../../../email/templates/render-hbs-template';
import { getTemplateAssetBase64 } from '../../../email/templates/template-asset.util';
import { PrismaService } from '../../../prisma/prisma.service';
import authConfig from '../../auth.config';
import { AUTH_EMAIL_SUBJECT } from '../../auth.constants';
import type { StartEmailLoginInput } from '../../input';
import type { EmailChallengeStart } from '../../objects';
import {
   createTokenHash,
   generateOtpCode,
   generateRandomToken,
   maskEmail,
} from '../../utils/auth-crypto.util';
import { AuthAuditService } from '../shared/auth-audit.service';
import { AuthChallengeService } from '../shared/auth-challenge.service';
import { AuthEmailQueueService } from '../shared/auth-email-queue.service';
import { AuthInstitutionAccessService } from '../shared/auth-institution-access.service';
import type { RequestMeta } from '../auth-context.service';

@Injectable()
export class StartEmailLoginService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly challengeService: AuthChallengeService,
      private readonly emailQueueService: AuthEmailQueueService,
      private readonly auditService: AuthAuditService,
      private readonly authInstitutionAccessService: AuthInstitutionAccessService,
      @Inject(authConfig.KEY)
      private readonly auth: ConfigType<typeof authConfig>,
      @Inject(appConfig.KEY)
      private readonly app: ConfigType<typeof appConfig>,
   ) {}

   async run(
      input: StartEmailLoginInput,
      meta?: RequestMeta,
   ): Promise<EmailChallengeStart> {
      const email = input.email.trim().toLowerCase();
      const user = await this.prisma.user.findUnique({
         where: { email },
         select: {
            id: true,
            role: true,
            Profile: { select: { name: true } },
         },
      });
      if (!user) {
         throw new BadRequestException('E-mail nao encontrado.');
      }

      const school = await this.authInstitutionAccessService.assertStartAccess({
         institutionCode: input.institutionCode,
         userId: user.id,
         role: user.role,
      });

      await this.challengeService.assertRateLimit({
         email,
         type: AuthChallengeTypeEnum.login_email,
         ip: meta?.ip,
         deviceId: input.deviceId,
      });

      const code = generateOtpCode();
      const magicToken = generateRandomToken(40);
      const expiresAt = this.challengeService.getChallengeExpiration();

      const challenge = await this.challengeService.createChallenge({
         type: AuthChallengeTypeEnum.login_email,
         channel: input.channel as PrismaAuthChannelEnum,
         email,
         userId: user.id,
         codeHash: createTokenHash(code),
         tokenHash: createTokenHash(magicToken),
         maxAttempts: this.auth.challenge.maxAttempts,
         expiresAt,
         payload: {
            deviceId: input.deviceId,
            deviceName: input.deviceName,
            schoolId: school.id,
            institutionCode: school.institutionCode,
         },
      });

      const loginLinkBase = this.app.baseAdminUrl || this.app.baseWebUrl;
      const magicLink = `${loginLinkBase.replace(/\/$/, '')}/auth/login/magic?token=${encodeURIComponent(magicToken)}`;
      const firstName = user.Profile?.name?.trim().split(/\s+/)[0];
      const logoBase64 = getTemplateAssetBase64(
         'logo-vaca-completa-branca.png',
      );

      await this.emailQueueService.run({
         to: email,
         subject: AUTH_EMAIL_SUBJECT.LOGIN_CHALLENGE,
         html: renderHbsTemplate('auth-login-code', {
            name: firstName,
            code,
            magicLink,
            challengeTtlMinutes: this.auth.challenge.ttlMinutes,
            appName: 'VACA',
            logoBase64,
         }),
      });

      await this.auditService.run({
         userId: user.id,
         eventType: AuthAuditEventTypeEnum.login_email_started,
         channel: input.channel as PrismaAuthChannelEnum,
         metadata: {
            email,
            schoolId: school.id,
            institutionCode: school.institutionCode,
         } as Prisma.InputJsonValue,
      });

      return {
         challengeId: challenge.id,
         maskedEmail: maskEmail(email),
         expiresAt,
      };
   }
}
