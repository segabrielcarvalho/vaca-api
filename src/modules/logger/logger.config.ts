import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const logConfig = registerAs('logger', () => {
   const getEnv = (envName: string) => process.env[envName];
   const toBool = (string: string) => string === 'true';

   return {
      file: { enable: toBool(getEnv('LOG_ENABLE_FILE') || 'true') },
      logSene: {
         enable: toBool(getEnv('LOG_ENABLE_LOGSENE') || 'false'),
         token: getEnv('LOGSENE_TOKEN'),
      },
      cloudWatch: {
         enable: toBool(getEnv('LOG_ENABLE_AWS_CLOUD_WATCH') || 'false'),
         logGroupName: getEnv('AWS_CLOUD_WATCH_GROUP_NAME'),
         logStreamName: getEnv('AWS_CLOUD_WATCH_STREAM_NAME'),
         awsConfig: {
            region: getEnv('AWS_CLOUD_WATCH_REGION') || getEnv('AWS_REGION'),
            accessKeyId:
               getEnv('AWS_CLOUD_WATCH_ACCESS_KEY_ID') ||
               getEnv('AWS_ACCESS_KEY_ID'),
            secretAccessKey:
               getEnv('AWS_CLOUD_WATCH_SECRET_ACCESS_KEY') ||
               getEnv('AWS_SECRET_ACCESS_KEY'),
         },
      },
   };
});

export const logConfigValidation = z
   .object({
      LOG_ENABLE_FILE: z
         .string()
         .default('true')
         .transform((val) => val === 'true'),

      LOG_ENABLE_LOGSENE: z
         .string()
         .default('false')
         .transform((val) => val === 'true'),
      LOGSENE_TOKEN: z.string().optional(),

      LOG_ENABLE_AWS_CLOUD_WATCH: z
         .string()
         .default('false')
         .transform((val) => val === 'true'),
      AWS_CLOUD_WATCH_GROUP_NAME: z.string().optional(),
      AWS_CLOUD_WATCH_STREAM_NAME: z.string().optional(),
      AWS_CLOUD_WATCH_REGION: z.string().optional(),
      AWS_REGION: z.string().optional(),
      AWS_CLOUD_WATCH_ACCESS_KEY_ID: z.string().optional(),
      AWS_ACCESS_KEY_ID: z.string().optional(),
      AWS_CLOUD_WATCH_SECRET_ACCESS_KEY: z.string().optional(),
      AWS_SECRET_ACCESS_KEY: z.string().optional(),
   })
   .refine(
      (data) =>
         !data.LOG_ENABLE_LOGSENE ||
         (data.LOG_ENABLE_LOGSENE && !!data.LOGSENE_TOKEN),
      {
         message: 'LOGSENE_TOKEN is required when LOG_ENABLE_LOGSENE is true',
         path: ['LOGSENE_TOKEN'],
      },
   )
   .refine(
      (data) =>
         !data.LOG_ENABLE_AWS_CLOUD_WATCH ||
         (data.LOG_ENABLE_AWS_CLOUD_WATCH &&
            data.AWS_CLOUD_WATCH_GROUP_NAME &&
            data.AWS_CLOUD_WATCH_STREAM_NAME &&
            (data.AWS_CLOUD_WATCH_REGION || data.AWS_REGION) &&
            (data.AWS_CLOUD_WATCH_ACCESS_KEY_ID || data.AWS_ACCESS_KEY_ID) &&
            (data.AWS_CLOUD_WATCH_SECRET_ACCESS_KEY ||
               data.AWS_SECRET_ACCESS_KEY)),
      {
         message:
            'CloudWatch configuration is incomplete. All required fields must be provided when LOG_ENABLE_AWS_CLOUD_WATCH is true.',
      },
   );

export function validateLogEnv(env: Record<string, unknown>) {
   try {
      logConfigValidation.parse(env);
   } catch (error) {
      console.error('Logger configuration validation failed:', error);
      process.exit(1);
   }
}

export default logConfig;
