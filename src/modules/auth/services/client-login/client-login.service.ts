import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { RoleEnum } from '@prisma/client';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import CentralDeVendasProvider from '../../../central-de-vendas/provider/CentralDeVendas.provider';
import { SyncMenteeLimitsService } from '../../../chat/mentee-usage-limit/services/sync-mentee-limits-service/sync-mentee-limits-service.service';
import { MyLogger } from '../../../logger/my-logger.service';
import { CreateLoginCodeService } from '../../../login-code/services/create/create-login-code.service';
import { PrismaService } from '../../../prisma/prisma.service';
import PROCESSORS from '../../../queue/constants/processor.constants';
import QUEUES from '../../../queue/constants/queue.constants';
import { ClientLoginArgs } from '../../args/client-login.args';
import { SendLoginCodeEmail } from '../../dto/send-login-code-email';
import { LoginObject } from '../../objects/login.object';

const LOGIN_MESSAGE =
   'Você receberá um código de acesso no e-mail informado, caso ele esteja registrado em nosso sistema.';

@Injectable()
export class ClientLoginService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      private readonly central: CentralDeVendasProvider,
      private readonly createLoginCode: CreateLoginCodeService,
      private readonly syncMenteeLimitsService: SyncMenteeLimitsService,
      @InjectQueue(QUEUES.EMAILS) private readonly emailQueue: Queue,
   ) {
      this.logger.setContext(ClientLoginService.name);
   }

   async run({ email }: ClientLoginArgs): Promise<LoginObject> {
      const { access, user } = await this.central.getUserPlans(email);

      if (!access?.hasAccess || !user) {
         this.logger.warn(
            `Acesso negado para ${email}: ${JSON.stringify({ access, user })}`,
         );
         return {
            token: randomBytes(48).toString('base64url'),
            message: LOGIN_MESSAGE,
         };
      }

      const dbUser = await this.ensureUser(email, user.name);

      const centralCodes = this.normalizePlanCodes(user.planIds ?? []);

      const validCentralCodes = await this.getValidPlanCodes(centralCodes);

      const dbCodes = dbUser.Mentee
         ? await this.getDbPlanCodes(dbUser.Mentee.id)
         : [];

      const finalCodes = Array.from(
         new Set([...validCentralCodes, ...dbCodes]),
      );

      if (dbUser.Mentee && finalCodes.length) {
         await this.syncMenteeLimitsService.run(dbUser.Mentee.id, finalCodes);
      }

      const { code, token } = await this.createLoginCode.run(dbUser.id);

      await this.enqueueLoginEmail(email, dbUser.name, code);

      return { token, message: LOGIN_MESSAGE };
   }

   private async getDbPlanCodes(menteeId: string): Promise<string[]> {
      const plans = await this.prisma.plan.findMany({
         where: {
            isActive: true,
            Limit: { is: { isActive: true } },
            Mentee: { some: { id: menteeId } },
         },
         select: { code: true },
      });
      return plans.map((p) => p.code);
   }

   private normalizePlanCodes(codes: string[]): string[] {
      return Array.from(
         new Set((codes ?? []).map((c) => String(c).trim()).filter(Boolean)),
      );
   }

   private async getValidPlanCodes(codes: string[]): Promise<string[]> {
      const normalized = this.normalizePlanCodes(codes);

      if (!normalized.length) return [];

      const plans = await this.prisma.plan.findMany({
         where: {
            code: { in: normalized },
            isActive: true,
            Limit: { is: { isActive: true } },
         },
         select: { code: true },
      });

      return plans.map((p) => p.code);
   }

   private async ensureUser(email: string, name: string) {
      const user = await this.prisma.user.upsert({
         where: { email },
         update: { lastSession: new Date(), name },
         create: { email, name, role: RoleEnum.mentee },
         include: { Mentee: true },
      });
      if (!user.Mentee) {
         await this.prisma.mentee.create({
            data: { userId: user.id, type: 'fl' },
         });
         return this.prisma.user.findUnique({
            where: { id: user.id },
            include: { Mentee: true },
         });
      }
      return user;
   }

   private async enqueueLoginEmail(email: string, name: string, code: string) {
      try {
         const payload: SendLoginCodeEmail = { code, to: { email, name } };

         await this.emailQueue.add(PROCESSORS.CLIENT_LOGIN_EMAIL, payload, {
            removeOnComplete: false,
         });

         this.logger.log(`Job de envio de e-mail adicionado para ${email}`);
      } catch (err) {
         this.logger.error(`Falha ao enviar e-mail para ${email}: ${err}`);
      }
   }
}
