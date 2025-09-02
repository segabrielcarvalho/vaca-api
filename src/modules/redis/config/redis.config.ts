import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const envSchema = z.object({
   REDIS_HOST: z.string().nonempty(),
   REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
   REDIS_USERNAME: z.string().optional(),
   REDIS_PASSWORD: z.string().optional(),
   REDIS_DB_QUEUE: z.coerce.number().int().min(0).default(0),
   REDIS_DB_WS: z.coerce.number().int().min(0).default(1),
});

export const redisConfig = registerAs('redis', () => {
   const env = envSchema.parse(process.env);

   const base = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      username: env.REDIS_USERNAME,
      password: env.REDIS_PASSWORD,
   };

   const buildUrl = (db: number) => {
      const auth = env.REDIS_PASSWORD ? `:${env.REDIS_PASSWORD}@` : '';
      return `redis://${auth}${env.REDIS_HOST}:${env.REDIS_PORT}/${db}`;
   };

   return {
      ...base,
      db: {
         queue: env.REDIS_DB_QUEUE,
         ws: env.REDIS_DB_WS,
      },
      buildUrl,
   };
});

export type RedisConfig = ReturnType<typeof redisConfig>;
