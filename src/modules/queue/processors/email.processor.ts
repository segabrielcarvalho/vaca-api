import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';

import { clientLoginCodeTemplate } from '../../auth/templates/client-login-code';
import IEmailProvider from '../../email/provider/IEmailProvider';
import { MyLogger } from '../../logger/my-logger.service';
import PROCESSORS from '../constants/processor.constants';
import QUEUES from '../constants/queue.constants';

@Processor(QUEUES.EMAILS)
export class EmailProcessor extends WorkerHost {
   constructor(
      private readonly logger: MyLogger,
      @Inject('EmailProvider')
      private emailProvider: IEmailProvider,
   ) {
      super();
      this.logger.setContext(EmailProcessor.name);
   }

   async process(job: Job<any, any, string>): Promise<any> {
      switch (job.name) {
         case PROCESSORS.CLIENT_LOGIN_EMAIL: {
            const { code, to } = job.data;
            const name = to.name;
            const html = await clientLoginCodeTemplate({
               appName: 'FIA by Grupo IGD',
               code,
               name,
               expirationMinutes: 10,
               to: { email: to.email, name: to.name },
            });

            await this.emailProvider.sendEmail({
               to: to.email,
               subject: 'Código de Acesso',
               html,
            });
            return this.logger.log(`Código de acesso enviado para ${to.email}`);
         }
         default:
            console.warn(`Nenhum handler definido para o job: ${job.name}`);
            return null;
      }
   }
}
