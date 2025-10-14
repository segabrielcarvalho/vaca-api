import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const appConfig = registerAs('app', () => {
   const port = parseInt(process.env.PORT, 10) || 20003;
   const environment = process.env.NODE_ENV;
   const baseApiUrl = process.env.BASE_API_URL || '';
   const baseWebUrl = process.env.BASE_WEB_URL || '';
   const apolloGraphRef = process.env.APOLLO_GRAPH_REF || '';
   return {
      port,
      environment,
      baseApiUrl,
      baseWebUrl,
      apolloGraphRef,
   };
});

export const appConfigValidation = z.object({
   PORT: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0, {
         message: 'PORT must be a valid port number',
      })
      .default('20003'),
   BASE_API_URL: z.string().url(),
   BASE_WEB_URL: z.string().url(),
   NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
});

export function validateAppEnv(env: Record<string, unknown>) {
   try {
      return appConfigValidation.parse(env);
   } catch (error) {
      console.error('App configuration validation failed:', error);
      throw error;
   }
}

export default appConfig;
