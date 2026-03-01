import { AuthAuditEventTypeEnum, Prisma } from '../../../../../.prisma/client';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../../storage/providers';
import type IS3Provider from '../../../storage/providers/s3/s3.interface';
import { AUTH_CONTEXT_SCOPE } from '../../auth.constants';
import type { CompleteInviteProfileInput } from '../../input';
import type { InviteProfileCompleted } from '../../objects';
import {
   isE164Phone,
   parseNotificationPrefs,
} from '../../utils/auth-crypto.util';
import { AuthAuditService } from '../shared/auth-audit.service';
import { AuthContextTokenService } from '../shared/auth-context-token.service';

@Injectable()
export class CompleteInviteProfileService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly contextTokenService: AuthContextTokenService,
      private readonly auditService: AuthAuditService,
      @Inject(STORAGE_PROVIDER)
      private readonly storageProvider: IS3Provider,
   ) {}

   async run(
      input: CompleteInviteProfileInput,
   ): Promise<InviteProfileCompleted> {
      const context = this.contextTokenService.assertContext(input.contextId, [
         AUTH_CONTEXT_SCOPE.INVITE_ONBOARDING,
      ]);

      if (!isE164Phone(input.phoneE164)) {
         throw new BadRequestException('Telefone deve estar em formato E.164.');
      }

      const prefs = parseNotificationPrefs(input.notificationPrefsJson);
      if (!prefs) {
         throw new BadRequestException('notificationPrefsJson invalido.');
      }

      const photoPath = await this.storageProvider.saveFileFromBase64(
         input.photoBase64,
         'auth/profile-photos',
      );

      const completedAt = new Date();

      await this.prisma.user.update({
         where: { id: context.userId },
         data: {
            verifiedEmail: true,
         },
      });

      await this.prisma.userProfile.upsert({
         where: { userId: context.userId },
         update: {
            name: input.name,
            phoneE164: input.phoneE164,
            photoPath,
            timezone: input.timezone,
            locale: input.locale,
            notificationPrefsJson: prefs,
            onboardingCompletedAt: completedAt,
         },
         create: {
            userId: context.userId,
            name: input.name,
            phoneE164: input.phoneE164,
            photoPath,
            timezone: input.timezone,
            locale: input.locale,
            notificationPrefsJson: prefs,
            onboardingCompletedAt: completedAt,
         },
      });

      await this.auditService.run({
         userId: context.userId,
         eventType: AuthAuditEventTypeEnum.invite_completed,
         channel: context.channel,
         metadata: {
            profileCompleted: true,
         } as Prisma.InputJsonValue,
      });

      return {
         contextId: input.contextId,
         profileCompletedAt: completedAt,
      };
   }
}
