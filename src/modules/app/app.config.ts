import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const appConfig = registerAs('app', () => {
   const toInt = (value: string | undefined, fallback: number) => {
      const parsed = parseInt(value ?? '', 10);
      return Number.isFinite(parsed) ? parsed : fallback;
   };
   const port = parseInt(process.env.PORT, 10) || 20003;
   const environment = process.env.NODE_ENV;
   const baseApiUrl = process.env.BASE_API_URL || '';
   const baseWebUrl = process.env.BASE_WEB_URL || '';
   const baseAdminUrl = process.env.BASE_ADMIN_URL || '';
   const apolloGraphRef = process.env.APOLLO_GRAPH_REF || '';
   return {
      port,
      environment,
      baseApiUrl,
      baseWebUrl,
      baseAdminUrl,
      apolloGraphRef,
      graphqlMaxDepth: toInt(process.env.GRAPHQL_MAX_DEPTH, 8),
      graphqlMaxComplexity: toInt(process.env.GRAPHQL_MAX_COMPLEXITY, 200),
      graphqlCacheTtlSec: toInt(process.env.GRAPHQL_CACHE_TTL_SEC, 5),
      graphqlPersistedQueryTtlSec: toInt(
         process.env.GRAPHQL_PERSISTED_QUERY_TTL_SEC,
         300,
      ),
   };
});

export const appConfigValidation = z.object({
   PORT: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0, {
         message: 'PORT deve ser um número de porta válido',
      })
      .default(20003),
   BASE_API_URL: z.string().url(),
   BASE_WEB_URL: z.string().url(),
   BASE_ADMIN_URL: z.string().url(),
   APOLLO_GRAPH_REF: z.string().optional().default(''),
   NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
   GRAPHQL_MAX_DEPTH: z.coerce.number().int().min(1).max(50).default(8),
   GRAPHQL_MAX_COMPLEXITY: z.coerce.number().int().min(1).default(200),
   GRAPHQL_CACHE_TTL_SEC: z.coerce.number().int().min(0).default(5),
   GRAPHQL_PERSISTED_QUERY_TTL_SEC: z.coerce.number().int().min(0).default(300),
});

export function validateAppEnv(env: NodeJS.ProcessEnv) {
   try {
      return appConfigValidation.parse(env);
   } catch (error) {
      console.error('Falha na validação da configuração do app:', error);
      throw error;
   }
}

export default appConfig;
