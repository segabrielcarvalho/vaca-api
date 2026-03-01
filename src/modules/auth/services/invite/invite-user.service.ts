import {
   AuthAuditEventTypeEnum,
   Prisma,
   RoleEnum as PrismaRoleEnum,
} from '../../../../../.prisma/client';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import appConfig from '../../../app/app.config';
import { renderHbsTemplate } from '../../../email/templates/render-hbs-template';
import { PrismaService } from '../../../prisma/prisma.service';
import authConfig from '../../auth.config';
import { AUTH_EMAIL_SUBJECT } from '../../auth.constants';
import type { InviteUserInput } from '../../input';
import type { ActionResultObject } from '../../objects';
import type { AuthCurrentUser } from '../auth-context.service';
import {
   createTokenHash,
   generateRandomToken,
} from '../../utils/auth-crypto.util';
import { AuthAuditService } from '../shared/auth-audit.service';
import { AuthEmailQueueService } from '../shared/auth-email-queue.service';

@Injectable()
export class InviteUserService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly auditService: AuthAuditService,
      private readonly emailQueueService: AuthEmailQueueService,
      @Inject(authConfig.KEY)
      private readonly auth: ConfigType<typeof authConfig>,
      @Inject(appConfig.KEY)
      private readonly app: ConfigType<typeof appConfig>,
   ) {}

   async run(
      actor: AuthCurrentUser,
      input: InviteUserInput,
   ): Promise<ActionResultObject> {
      const email = input.email.trim().toLowerCase();
      const role: PrismaRoleEnum =
         input.role != null
            ? (input.role as unknown as PrismaRoleEnum)
            : PrismaRoleEnum.user;

      const existingActiveInvite = await this.prisma.authInvite.findFirst({
         where: {
            email,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
         },
      });

      if (existingActiveInvite) {
         throw new ConflictException(
            'Ja existe um convite ativo para esse e-mail.',
         );
      }

      const user = await this.prisma.user.upsert({
         where: { email },
         update: { role },
         create: { email, role, isActive: true },
      });

      const rawToken = generateRandomToken(40);
      const tokenHash = createTokenHash(rawToken);
      const expiresAt = new Date(
         Date.now() + this.auth.invite.ttlHours * 60 * 60 * 1000,
      );

      await this.prisma.authInvite.create({
         data: {
            email,
            role,
            tokenHash,
            userId: user.id,
            invitedByUserId: actor.id,
            metadata: input.metadataJson
               ? ({ raw: input.metadataJson } as Prisma.InputJsonValue)
               : undefined,
            expiresAt,
         },
      });

      const inviteLinkBase = this.app.baseAdminUrl || this.app.baseWebUrl;
      const inviteLink = `${inviteLinkBase.replace(/\/$/, '')}/auth/invite?token=${encodeURIComponent(rawToken)}`;

      await this.emailQueueService.run({
         to: email,
         subject: AUTH_EMAIL_SUBJECT.INVITE,
         html: renderHbsTemplate('auth-invite', {
            inviteTtlHours: this.auth.invite.ttlHours,
            inviteLink,
         }),
      });

      await this.auditService.run({
         userId: actor.id,
         eventType: AuthAuditEventTypeEnum.invite_created,
         channel: null,
         metadata: { invitedEmail: email, role } as Prisma.InputJsonValue,
      });

      return { message: 'Convite enviado com sucesso.', statusCode: 200 };
   }
}
