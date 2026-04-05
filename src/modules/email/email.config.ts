import { registerAs } from '@nestjs/config';
import { z } from 'zod';

enum EmailDriverEnum {
   ethereal = 'ethereal',
   ses = 'ses',
   sendgrid = 'sendgrid',
}

const emailConfig = registerAs('email', () => {
   return {
      driver: process.env.EMAIL_DRIVER as EmailDriverEnum,
      default: {
         from: {
            email: process.env.EMAIL_DEFAULT_FROM,
            name: process.env.EMAIL_DEFAULT_FROM_NAME,
         },
      },
      sendgrid: { apiKey: process.env.SENDGRID_API_KEY },
      ses: {
         endpoint: process.env.AWS_SES_ENDPOINT,
         accessKeyId:
            process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
         secretAccessKey:
            process.env.AWS_SES_SECRET_ACCESS_KEY ||
            process.env.AWS_SECRET_ACCESS_KEY,
         region: process.env.AWS_SES_REGION || process.env.AWS_REGION,
      },
   };
});

export const emailConfigValidation = z.object({
   EMAIL_DRIVER: z.enum(['ethereal', 'ses', 'sendgrid']).default('ethereal'),
   EMAIL_DEFAULT_FROM: z.string().email(),
   EMAIL_DEFAULT_FROM_NAME: z
      .string()
      .regex(/^[a-zA-Z -]+$/)
      .default('VoteMe'),
   SENDGRID_API_KEY: z
      .string()
      .optional()
      .refine(
         (val) => {
            if (
               emailConfigValidation.shape.EMAIL_DRIVER.safeParse(val)
                  .success &&
               val === 'sendgrid'
            ) {
               return !!val;
            }
            return true;
         },
         {
            message:
               'SENDGRID_API_KEY é obrigatório quando EMAIL_DRIVER for sendgrid',
         },
      ),
   AWS_SES_ENDPOINT: z.string().optional(),
   AWS_SES_ACCESS_KEY_ID: z.string().optional(),
   AWS_SES_SECRET_ACCESS_KEY: z.string().optional(),
   AWS_SES_REGION: z.string().optional(),
   AWS_ACCESS_KEY_ID: z.string().optional(),
   AWS_SECRET_ACCESS_KEY: z.string().optional(),
   AWS_REGION: z.string().optional(),
});

export function validateEmailEnv(env: NodeJS.ProcessEnv) {
   try {
      return emailConfigValidation.parse(env);
   } catch (error) {
      console.error('Falha na validação da configuração de e-mail:', error);
      throw error;
   }
}

export default emailConfig;
