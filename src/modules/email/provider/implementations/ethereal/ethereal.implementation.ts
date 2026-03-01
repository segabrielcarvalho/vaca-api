import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MyLogger } from '../../../../logger/my-logger.service';
import emailConfig from '../../../email.config';
import IEmailProvider, { SendEmailInput } from '../../IEmailProvider';

@Injectable()
export default class EtherealImplementation implements IEmailProvider {
   private client?: nodemailer.Transporter;

   private readonly logger: LoggerLike;

   constructor(
      @Inject(emailConfig.KEY)
      private readonly config: ConfigType<typeof emailConfig>,
      logger: LoggerLike,
   ) {
      this.logger = logger;
      this.logger.setContext?.(EtherealImplementation.name);
   }

   public async sendEmail({
      to,
      from,
      subject,
      html,
      attachments,
   }: SendEmailInput): Promise<void> {
      if (!this.client) this.client = await this.getClient();
      const { email, name } = this.config.default.from;
      const emailData = {
         from:
            typeof from === 'string'
               ? from
               : { name: from?.name || name, address: from?.email || email },
         to: typeof to === 'string' ? to : { name: to.name, address: to.email },
         subject,
         html,
         attachments,
      };
      const message = await this.client.sendMail(emailData);
      this.logger.log(`Email URL: ${nodemailer.getTestMessageUrl(message)}`);
      return;
   }

   private async getClient(): Promise<nodemailer.Transporter> {
      const { user, pass, smtp } = await nodemailer.createTestAccount();
      return nodemailer.createTransport({ ...smtp, auth: { user, pass } });
   }
}

type LoggerLike = Pick<
   MyLogger,
   'setContext' | 'log' | 'error' | 'warn' | 'debug'
>;
