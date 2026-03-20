import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const envSchema = z.object({
   OMR_BASE_URL: z.string().url().default('http://localhost:11001'),
   OMR_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
   CORRECTION_DEBUG_TRACE: z
      .string()
      .default('false')
      .transform((value) => value === 'true'),
   CORRECTION_AUDIT_RETENTION_DAYS: z.coerce.number().int().min(1).default(365),
   CORRECTION_RETENTION_INTERVAL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .default(24),
});

const correctionConfig = registerAs('correction', () => {
   const env = envSchema.parse(process.env);

   return {
      omrBaseUrl: env.OMR_BASE_URL,
      omrRequestTimeoutMs: env.OMR_REQUEST_TIMEOUT_MS,
      debugTrace: env.CORRECTION_DEBUG_TRACE,
      auditRetentionDays: env.CORRECTION_AUDIT_RETENTION_DAYS,
      retentionIntervalHours: env.CORRECTION_RETENTION_INTERVAL_HOURS,
   };
});

export const validateCorrectionEnv = (env: NodeJS.ProcessEnv) =>
   envSchema.parse(env);

export default correctionConfig;
