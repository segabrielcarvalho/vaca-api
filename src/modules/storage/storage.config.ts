import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export enum StorageEnvironmentEnum {
   Local = 'local',
   Cloud = 'cloud',
}

export interface StorageConfig {
   environment: StorageEnvironmentEnum;
   storage: {
      bucket: string;
      region?: string;
      cloudFrontUrl: string;
      credentials?: {
         accessKeyId: string;
         secretAccessKey: string;
      };
      endpoint: string;
   };
}

export const storageConfig = registerAs('storage', () => {
   const environment = process.env
      .STORAGE_ENVIRONMENT as StorageEnvironmentEnum;
   const cloudFrontUrl = process.env.STORAGE_CLOUD_FRONT_URL!;
   const endpoint = process.env.STORAGE_ENDPOINT!;
   const bucket = process.env.STORAGE_BUCKET!;
   const region = process.env.STORAGE_REGION;
   const accessKeyId = process.env.AWS_ACCESS_KEY_ID!;
   const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;

   return {
      environment,
      storage: {
         bucket,
         region,
         cloudFrontUrl,
         endpoint,
         credentials:
            environment === StorageEnvironmentEnum.Cloud
               ? {
                    accessKeyId: accessKeyId!,
                    secretAccessKey: secretAccessKey!,
                 }
               : undefined,
      },
   } as StorageConfig;
});

export const storageConfigValidation = z
   .object({
      STORAGE_ENVIRONMENT: z
         .enum(['local', 'cloud'])
         .default('local')
         .transform((val) =>
            val === 'local'
               ? StorageEnvironmentEnum.Local
               : StorageEnvironmentEnum.Cloud,
         ),
      STORAGE_BUCKET: z.string().default('igd-agents'),
      STORAGE_ENDPOINT: z.string().url().default('http://localhost:4566'),
      STORAGE_CLOUD_FRONT_URL: z
         .string()
         .url()
         .default('http://localhost:4566'),
      STORAGE_REGION: z.string().optional(),
      AWS_ACCESS_KEY_ID: z.string().optional(),
      AWS_SECRET_ACCESS_KEY: z.string().optional(),
   })
   .refine(
      (data) =>
         data.STORAGE_ENVIRONMENT === StorageEnvironmentEnum.Local ||
         (data.STORAGE_ENVIRONMENT === StorageEnvironmentEnum.Cloud &&
            !!data.AWS_ACCESS_KEY_ID &&
            !!data.AWS_SECRET_ACCESS_KEY &&
            !!data.STORAGE_REGION),
      {
         message:
            'Em ambiente "cloud", AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY e STORAGE_REGION são obrigatórios.',
         path: ['AWS_ACCESS_KEY_ID'],
      },
   );

export function validateStorageEnv(env: Record<string, unknown>) {
   try {
      return storageConfigValidation.parse(env);
   } catch (error) {
      console.error('Falha na validação de storage env:', error);
      throw error;
   }
}

export default storageConfig;
