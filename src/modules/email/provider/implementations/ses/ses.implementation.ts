import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Readable } from 'stream';
import { MyLogger } from '../../../../logger/my-logger.service';
import emailConfig from '../../../email.config';
import IEmailProvider, {
   Attachment,
   SendEmailInput,
} from '../../IEmailProvider';

@Injectable()
export default class SesImplementation implements IEmailProvider {
   private readonly sesClient: SESClient;
   private readonly logger: LoggerLike;

   constructor(
      @Inject(emailConfig.KEY)
      private readonly config: ConfigType<typeof emailConfig>,
      logger: LoggerLike,
   ) {
      this.logger = logger;
      this.logger.setContext?.(SesImplementation.name);

      const { accessKeyId, secretAccessKey, region, endpoint } = this.config.ses;

      this.sesClient = new SESClient({
         region,
         endpoint,
         credentials:
            accessKeyId && secretAccessKey
               ? { accessKeyId, secretAccessKey }
               : undefined,
      });
   }

   public async sendEmail(params: SendEmailInput): Promise<void> {
      const { subject, to, html } = params;
      const from = params.from || this.config.default.from;
      const attachments = params.attachments
         ? await this.formatAttachments(params.attachments)
         : undefined;

      const transporter = nodemailer.createTransport({
         streamTransport: true,
         newline: 'unix',
         buffer: true,
      });

      const mailOptions = {
         from:
            typeof from === 'string'
               ? from
               : { name: from.name, address: from.email },
         to: typeof to === 'string' ? to : { name: to.name, address: to.email },
         subject,
         html,
         attachments,
      };

      try {
         const info = await transporter.sendMail(mailOptions);
         const rawMessage = info.message as Buffer;

         const command = new SendRawEmailCommand({
            RawMessage: { Data: rawMessage },
         });
         const result = await this.sesClient.send(command);

         this.logger.log(
            `Email enviado via SES. MessageId: ${result.MessageId}`,
         );
      } catch (error) {
         const err = error instanceof Error ? error : new Error(String(error));
         this.logger.error(
            `Erro ao enviar email via SES: ${err.message}`,
            err.stack,
         );
         throw err;
      }
   }

   private async streamToString(stream: Readable): Promise<string> {
      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
         stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
         stream.on('error', reject);
         stream.on('end', () =>
            resolve(Buffer.concat(chunks).toString('utf8')),
         );
      });
   }

   private async formatAttachments(attachments: Attachment[]) {
      return Promise.all(
         attachments.map(async (att) => {
            let { content } = att;

            if (content instanceof Buffer) {
               content = content.toString('base64');
            } else if (content instanceof Readable) {
               content = await this.streamToString(content);
               content = Buffer.from(content).toString('base64');
            }

            if (typeof content !== 'string') {
               throw new Error('O anexo nao e uma string');
            }

            return {
               filename: att.filename,
               content,
               contentType: att.type,
               contentDisposition: 'attachment',
            };
         }),
      );
   }
}

type LoggerLike = Pick<
   MyLogger,
   'setContext' | 'log' | 'error' | 'warn' | 'debug'
>;
