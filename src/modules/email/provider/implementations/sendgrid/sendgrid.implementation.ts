import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { Readable } from 'stream';
import { MyLogger } from '../../../../logger/my-logger.service';
import emailConfig from '../../../email.config';
import IEmailProvider, {
   Attachment,
   SendEmailInput,
} from '../../IEmailProvider';

@Injectable()
export default class SendGridImplementation implements IEmailProvider {
   private client = sgMail;
   private readonly logger: LoggerLike;

   constructor(
      @Inject(emailConfig.KEY)
      private readonly config: ConfigType<typeof emailConfig>,
      logger: LoggerLike,
   ) {
      this.logger = logger;
      this.client.setApiKey(this.config.sendgrid.apiKey);
      this.logger.setContext?.(SendGridImplementation.name);
   }

   async sendEmail(params: SendEmailInput) {
      const { subject, to, html } = params;
      const from = params.from || this.config.default.from;
      const attachments = params.attachments
         ? await this.formatAttachments(params.attachments)
         : undefined;
      if (html)
         try {
            await this.client.send({
               from,
               subject,
               to,
               html,
               attachments,
            });
         } catch (error) {
            const err =
               error instanceof Error ? error : new Error(String(error));
            this.logger.error(err);
         }
   }

   private async streamToString(stream: Readable): Promise<string> {
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
         stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
         stream.on('error', (err) => reject(err));
         stream.on('end', () =>
            resolve(Buffer.concat(chunks).toString('utf8')),
         );
      });
   }

   private async formatAttachments(attachments: Attachment[]) {
      return await Promise.all(
         attachments.map(async (att) => {
            let { content } = att;
            if (content instanceof Buffer) {
               content = content.toString('base64');
            } else if (content instanceof Readable) {
               content = await this.streamToString(content);
               content = Buffer.from(content).toString('base64');
            }
            if (typeof content !== 'string')
               throw new Error('O anexo não é uma string');
            return {
               content,
               filename: att.filename,
               type: att.type,
               disposition: 'attachment',
               contentId: att.filename,
            };
         }),
      );
   }
}

type LoggerLike = Pick<
   MyLogger,
   'setContext' | 'log' | 'error' | 'warn' | 'debug'
>;
