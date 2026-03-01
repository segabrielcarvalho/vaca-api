import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const optionalNumber = z.preprocess(
   (val) => (val === '' || val === undefined ? undefined : val),
   z.coerce.number().int().min(0).optional(),
);

const envSchema = z.object({
   REDIS_HOST: z.string().nonempty(),
   REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
   REDIS_USERNAME: z.string().optional(),
   REDIS_PASSWORD: z.string().optional(),
   REDIS_DB_QUEUE: z.coerce.number().int().min(0).default(0),
   REDIS_DB_WS: z.coerce.number().int().min(0).default(1),
   REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).default(10000),
   REDIS_KEEP_ALIVE_MS: z.coerce.number().int().min(0).default(30000),
   REDIS_MAX_RETRIES: z.coerce.number().int().min(0).default(10),
   REDIS_MAX_RETRIES_PER_REQUEST: optionalNumber,
   REDIS_KEY_PREFIX: z.string().optional(),
});

export const redisConfig = registerAs('redis', () => {
   const env = envSchema.parse(process.env);
   const keyPrefix =
      env.REDIS_KEY_PREFIX && env.REDIS_KEY_PREFIX.trim().length > 0
         ? env.REDIS_KEY_PREFIX.trim()
         : undefined;
   const maxRetriesPerRequest =
      env.REDIS_MAX_RETRIES_PER_REQUEST === undefined
         ? null
         : env.REDIS_MAX_RETRIES_PER_REQUEST;

   const base = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      username: env.REDIS_USERNAME,
      password: env.REDIS_PASSWORD,
      connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
      keepAlive: env.REDIS_KEEP_ALIVE_MS,
      maxRetriesPerRequest,
      keyPrefix,
   };

   const buildUrl = (db: number) => {
      const user = env.REDIS_USERNAME
         ? encodeURIComponent(env.REDIS_USERNAME)
         : '';
      const pass = env.REDIS_PASSWORD
         ? `:${encodeURIComponent(env.REDIS_PASSWORD)}`
         : '';
      const auth = user || pass ? `${user}${pass}@` : '';
      return `redis://${auth}${env.REDIS_HOST}:${env.REDIS_PORT}/${db}`;
   };

   return {
      ...base,
      db: {
         queue: env.REDIS_DB_QUEUE,
         ws: env.REDIS_DB_WS,
      },
      maxRetries: env.REDIS_MAX_RETRIES,
      buildUrl,
   };
});

export type RedisConfig = ReturnType<typeof redisConfig>;
export const redisEnvSchema = envSchema;
export const validateRedisEnv = (env: NodeJS.ProcessEnv) =>
   envSchema.parse(env);
