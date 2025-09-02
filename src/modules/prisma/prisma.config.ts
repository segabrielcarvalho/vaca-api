import { registerAs } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export interface PrismaConfigType {
   log: Prisma.LogLevel[];
   errorFormat: Prisma.ErrorFormat;
}

const parseLogLevels = (env: Partial<Record<string, string>>) => {
   const levels: Prisma.LogLevel[] = [];
   if (env.PRISMA_LOG_ERROR === 'true') levels.push('error');
   if (env.PRISMA_LOG_WARN === 'true') levels.push('warn');
   if (env.PRISMA_LOG_INFO === 'true') levels.push('info');
   if (env.PRISMA_LOG_QUERY === 'true') levels.push('query');
   return levels;
};

export const prismaConfig = registerAs('prisma', () => {
   const {
      PRISMA_LOG_ERROR,
      PRISMA_LOG_WARN,
      PRISMA_LOG_INFO,
      PRISMA_LOG_QUERY,
      PRISMA_ERROR_FORMAT,
   } = process.env;

   const log = parseLogLevels({
      PRISMA_LOG_ERROR,
      PRISMA_LOG_WARN,
      PRISMA_LOG_INFO,
      PRISMA_LOG_QUERY,
   });

   const errorFormat = (PRISMA_ERROR_FORMAT as Prisma.ErrorFormat) || 'pretty';
   return { log, errorFormat };
});

export const prismaConfigValidation = z
   .object({
      PRISMA_LOG_ERROR: z
         .string()
         .default('false')
         .transform((val) => val === 'true'),
      PRISMA_LOG_WARN: z
         .string()
         .default('false')
         .transform((val) => val === 'true'),
      PRISMA_LOG_INFO: z
         .string()
         .default('false')
         .transform((val) => val === 'true'),
      PRISMA_LOG_QUERY: z
         .string()
         .default('false')
         .transform((val) => val === 'true'),
      PRISMA_ERROR_FORMAT: z
         .enum(['pretty', 'colorless', 'minimal'])
         .default('pretty'),
   })
   .transform((env) => {
      return {
         log: [
            env.PRISMA_LOG_ERROR && 'error',
            env.PRISMA_LOG_WARN && 'warn',
            env.PRISMA_LOG_INFO && 'info',
            env.PRISMA_LOG_QUERY && 'query',
         ].filter(Boolean) as Prisma.LogLevel[],
         errorFormat: env.PRISMA_ERROR_FORMAT,
      };
   });

export function validatePrismaEnv(
   env: Record<string, unknown>,
): PrismaConfigType {
   try {
      return prismaConfigValidation.parse(env);
   } catch (error) {
      console.error('Prisma configuration validation failed:', error);
      throw error;
   }
}

export default prismaConfig;
