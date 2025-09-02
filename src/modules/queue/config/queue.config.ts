import { registerAs } from '@nestjs/config';
import { z } from 'zod';

export interface QueueConfig {
   host: string;
   port: number;
   password?: string;
   db?: number;
}

const queueConfig = registerAs('queue', (): QueueConfig => {
   return {
      host: process.env.QUEUE_HOST || 'localhost',
      port: parseInt(process.env.QUEUE_PORT, 10) || 6379,
      password: process.env.QUEUE_PASSWORD,
      db: process.env.QUEUE_DB ? parseInt(process.env.QUEUE_DB, 10) : 0,
   };
});

export const queueConfigValidation = z.object({
   QUEUE_HOST: z.string(),
   QUEUE_PORT: z.string().regex(/^\d+$/),
   QUEUE_PASSWORD: z.string().optional(),
   QUEUE_DB: z.string().regex(/^\d+$/).optional(),
});

export function validateQueueEnv(env: Record<string, unknown>) {
   try {
      return queueConfigValidation.parse(env);
   } catch (error) {
      console.error('Queue config validation error:', error);
      throw error;
   }
}

export default queueConfig;
