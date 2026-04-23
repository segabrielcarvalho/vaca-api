import {
   AuthAuditEventTypeEnum,
   AuthChannelEnum as PrismaAuthChannelEnum,
   Prisma,
} from '../../../../../.prisma/client';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../../storage/providers';
import type IS3Provider from '../../../storage/providers/s3/s3.interface';
import { AUTH_CONTEXT_SCOPE } from '../../auth.constants';
import type { CompleteInviteProfileInput } from '../../input';
import type { AuthSessionResult } from '../../objects';
import {
   isE164Phone,
   parseNotificationPrefs,
} from '../../utils/auth-crypto.util';
import { AuthAuditService } from '../shared/auth-audit.service';
import { AuthContextTokenService } from '../shared/auth-context-token.service';
import type { RequestMeta } from '../auth-context.service';
import { AuthSessionService } from '../shared/auth-session.service';

@Injectable()
export class CompleteInviteProfileService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly contextTokenService: AuthContextTokenService,
      private readonly auditService: AuthAuditService,
      private readonly sessionService: AuthSessionService,
      @Inject(STORAGE_PROVIDER)
      private readonly storageProvider: IS3Provider,
   ) {}

   async run(
      input: CompleteInviteProfileInput,
      meta?: RequestMeta,
   ): Promise<AuthSessionResult> {
      const context = this.contextTokenService.assertContext(input.contextId, [
         AUTH_CONTEXT_SCOPE.INVITE_ONBOARDING,
      ]);
      const channel = input.channel as PrismaAuthChannelEnum;

      if (context.channel !== channel) {
         throw new BadRequestException('Canal do onboarding invalido.');
      }

      const invite = await this.prisma.authInvite.findUnique({
         where: { id: context.inviteId },
         select: {
            id: true,
            userId: true,
            role: true,
            metadata: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
         },
      });

      if (!invite || !invite.userId || invite.userId !== context.userId) {
         throw new BadRequestException('Convite invalido para onboarding.');
      }
      if (invite.revokedAt) {
         throw new BadRequestException('Convite revogado.');
      }
      if (invite.acceptedAt) {
         throw new BadRequestException('Convite ja utilizado.');
      }
      if (invite.expiresAt.getTime() <= Date.now()) {
         throw new BadRequestException('Convite expirado.');
      }

      if (!isE164Phone(input.phoneE164)) {
         throw new BadRequestException('Telefone deve estar em formato E.164.');
      }

      const prefs = parseNotificationPrefs(input.notificationPrefsJson);
      if (!prefs) {
         throw new BadRequestException('notificationPrefsJson invalido.');
      }

      const schoolId = this.getSelectedSchoolId(invite.metadata);
      const photoBase64 = input.photoBase64.trim();
      const photoPath = await this.storageProvider.saveFileFromBase64(
         photoBase64,
         'auth/profile-photos',
      );

      const completedAt = new Date();
      const authDevice = await this.prisma.authDevice.upsert({
         where: {
            userId_channel_deviceId: {
               userId: context.userId,
               channel,
               deviceId: input.deviceId,
            },
         },
         update: {
            deviceName: input.deviceName,
            lastSeenAt: completedAt,
         },
         create: {
            userId: context.userId,
            channel,
            deviceId: input.deviceId,
            deviceName: input.deviceName,
            lastSeenAt: completedAt,
         },
      });

      await this.prisma.$transaction([
         this.prisma.user.update({
            where: { id: context.userId },
            data: {
               verifiedEmail: true,
            },
         }),
         this.prisma.userProfile.upsert({
            where: { userId: context.userId },
            update: {
               name: input.name.trim(),
               phoneE164: input.phoneE164,
               photoPath,
               timezone: input.timezone,
               locale: input.locale,
               notificationPrefsJson: prefs,
               onboardingCompletedAt: completedAt,
            },
            create: {
               userId: context.userId,
               name: input.name.trim(),
               phoneE164: input.phoneE164,
               photoPath,
               timezone: input.timezone,
               locale: input.locale,
               notificationPrefsJson: prefs,
               onboardingCompletedAt: completedAt,
            },
         }),
         this.prisma.authInvite.update({
            where: { id: invite.id },
            data: {
               acceptedAt: completedAt,
            },
         }),
      ]);

      const issued = await this.sessionService.run({
         userId: context.userId,
         role: invite.role,
         channel,
         authDeviceId: authDevice.id,
         selectedSchoolId: schoolId,
         meta,
      });

      await this.auditService.run({
         userId: context.userId,
         eventType: AuthAuditEventTypeEnum.invite_completed,
         channel,
         metadata: {
            profileCompleted: true,
            inviteId: invite.id,
            selectedSchoolId: schoolId,
            sessionId: issued.session.sessionId,
         } as Prisma.InputJsonValue,
      });

      return issued.session;
   }

   private getSelectedSchoolId(metadata: Prisma.JsonValue | null | undefined) {
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
         throw new BadRequestException(
            'Convite sem metadata institucional valida.',
         );
      }

      const raw = (metadata as Record<string, unknown>).raw;
      if (typeof raw !== 'string' || raw.trim().length === 0) {
         throw new BadRequestException(
            'Convite sem metadata institucional valida.',
         );
      }

      let parsed: unknown;
      try {
         parsed = JSON.parse(raw);
      } catch {
         throw new BadRequestException(
            'Convite sem metadata institucional valida.',
         );
      }

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
         throw new BadRequestException(
            'Convite sem metadata institucional valida.',
         );
      }

      const source = (parsed as Record<string, unknown>).source;
      if (source !== 'school_members_admin') {
         throw new BadRequestException(
            'Convite com origem institucional invalida.',
         );
      }

      const schoolId = (parsed as Record<string, unknown>).schoolId;
      if (typeof schoolId !== 'string' || schoolId.trim().length === 0) {
         throw new BadRequestException('Convite sem schoolId no metadata.');
      }

      return schoolId.trim();
   }
}
