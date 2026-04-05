import {
   AuthAuditEventTypeEnum,
   AuthChallengeTypeEnum,
   AuthChannelEnum as PrismaAuthChannelEnum,
   Prisma,
} from '../../../../../.prisma/client';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { VerifyEmailLoginCodeInput } from '../../input';
import type { AuthSessionResult } from '../../objects';
import type { RequestMeta } from '../auth-context.service';
import { AuthAuditService } from '../shared/auth-audit.service';
import { AssertChallengeChannelBindingService } from '../shared/assert-challenge-channel-binding.service';
import { AuthChallengeService } from '../shared/auth-challenge.service';
import { AuthInstitutionAccessService } from '../shared/auth-institution-access.service';
import { AuthSessionService } from '../shared/auth-session.service';

@Injectable()
export class VerifyEmailLoginCodeService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly challengeService: AuthChallengeService,
      private readonly sessionService: AuthSessionService,
      private readonly auditService: AuthAuditService,
      private readonly assertChallengeChannelBindingService: AssertChallengeChannelBindingService,
      private readonly authInstitutionAccessService: AuthInstitutionAccessService,
   ) {}

   async run(
      input: VerifyEmailLoginCodeInput,
      meta: RequestMeta,
   ): Promise<AuthSessionResult> {
      const challenge = await this.challengeService.findById({
         id: input.challengeId,
         type: AuthChallengeTypeEnum.login_email,
      });
      this.challengeService.assertChallengeActive(challenge);

      const challengeEmail = challenge.email?.trim().toLowerCase();
      if (!challengeEmail) {
         throw new UnauthorizedException('Nao autorizado.');
      }

      let user = challenge.userId
         ? await this.prisma.user.findUnique({
              where: { id: challenge.userId },
           })
         : await this.prisma.user.findUnique({
              where: { email: challengeEmail },
           });

      if (!user) {
         throw new UnauthorizedException('Nao autorizado.');
      }

      const isTestBypass = user.isTest && input.code === '000000';

      if (!isTestBypass) {
         const valid = await this.challengeService.verifyChallengeCode(
            challenge,
            input.code,
         );
         if (!valid) {
            throw new UnauthorizedException('Codigo invalido ou expirado.');
         }
      }

      this.assertChallengeChannelBindingService.run({
         challengeChannel: challenge.channel,
         inputChannel: input.channel as PrismaAuthChannelEnum,
      });

      const payload = this.challengeService.getChallengePayload(challenge);
      if (payload.deviceId && payload.deviceId !== input.deviceId) {
         throw new UnauthorizedException(
            'Dispositivo invalido para o desafio.',
         );
      }

      const challengeSchool =
         await this.authInstitutionAccessService.assertChallengeAccess({
            schoolId: payload.schoolId,
            institutionCode: payload.institutionCode,
            userId: user.id,
            role: user.role,
         });

      await this.challengeService.consumeChallenge(challenge);

      const payloadDeviceName =
         typeof payload.deviceName === 'string'
            ? payload.deviceName
            : undefined;
      const authDevice = await this.prisma.authDevice.upsert({
         where: {
            userId_channel_deviceId: {
               userId: user.id,
               channel: input.channel as PrismaAuthChannelEnum,
               deviceId: input.deviceId,
            },
         },
         update: {
            deviceName: payloadDeviceName ?? input.deviceName,
            lastSeenAt: new Date(),
         },
         create: {
            userId: user.id,
            channel: input.channel as PrismaAuthChannelEnum,
            deviceId: input.deviceId,
            deviceName: payloadDeviceName ?? input.deviceName,
            lastSeenAt: new Date(),
         },
      });

      const issued = await this.sessionService.run({
         userId: user.id,
         role: user.role,
         channel: input.channel as PrismaAuthChannelEnum,
         authDeviceId: authDevice.id,
         selectedSchoolId: challengeSchool.id,
         meta,
      });

      await this.auditService.run({
         userId: user.id,
         eventType: AuthAuditEventTypeEnum.login_email_verified,
         channel: input.channel as PrismaAuthChannelEnum,
         metadata: {
            sessionId: issued.session.sessionId,
         } as Prisma.InputJsonValue,
      });

      return issued.session;
   }
}
