import { Readable } from 'stream';

export default interface IEmailProvider {
   sendEmail(params: SendEmailInput): Promise<void>;
}

export type EmailContact = { name: string; email: string } | string;

export type SendEmailInput = {
   to: EmailContact;
   from?: EmailContact;
   subject: string;
   html: string;
   attachments?: Attachment[];
};

export type Attachment = {
   filename: string;
   content: string | Buffer | Readable;
   type: keyof typeof MimeType;
};

export enum MimeType {
   xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   image_png = 'image/png',
   image_jpeg = 'image/jpeg',
   pdf = 'application/pdf',
   csv = 'text/csv',
}
