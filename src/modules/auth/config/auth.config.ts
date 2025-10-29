import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const authConfig = registerAs('auth', () => ({
   accessSecret: process.env.JWT_ACCESS_SECRET,
   accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
   refreshSecret: process.env.JWT_REFRESH_SECRET,
   refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
}));

export const authConfigValidation = z
   .object({
      JWT_ACCESS_SECRET: z.string().default('dev-access-secret'),
      JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
      JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret'),
      JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
   })
   .merge(
      z.object({
         GOOGLE_CLIENT_ID: z
            .string()
            .min(1, 'GOOGLE_CLIENT_ID must be provided'),
         GOOGLE_CLIENT_SECRET: z
            .string()
            .min(1, 'GOOGLE_CLIENT_SECRET must be provided'),
         GOOGLE_CALLBACK_URL: z
            .string()
            .url('GOOGLE_CALLBACK_URL must be a valid URL'),
         GOOGLE_REDIRECT_URL: z
            .string()
            .url('GOOGLE_REDIRECT_URL must be a valid URL')
            .optional()
            .or(z.literal(''))
            .transform((value) => (value ? value : undefined)),
      }),
   );

export function validateAuthEnv(env: Record<string, unknown>) {
   try {
      return authConfigValidation.parse(env);
   } catch (error) {
      console.error('Auth configuration validation failed:', error);
      throw error;
   }
}

export default authConfig;
