import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const parseBool = (value: string | undefined, fallback: boolean) => {
   if (value == null || value === '') return fallback;
   const normalized = value.trim().toLowerCase();
   if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
   if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
   return fallback;
};

const parseDurationToSeconds = (value: string, fallbackSeconds: number) => {
   const normalized = value.trim();
   const match = normalized.match(/^(\d+)\s*([smhd])$/i);
   if (!match) {
      const asInt = parseInt(normalized, 10);
      return Number.isFinite(asInt) && asInt > 0 ? asInt : fallbackSeconds;
   }

   const amount = parseInt(match[1], 10);
   const unit = match[2].toLowerCase();

   if (!Number.isFinite(amount) || amount <= 0) return fallbackSeconds;

   if (unit === 's') return amount;
   if (unit === 'm') return amount * 60;
   if (unit === 'h') return amount * 60 * 60;
   if (unit === 'd') return amount * 60 * 60 * 24;

   return fallbackSeconds;
};

const parseIntSafe = (value: string | undefined, fallback: number) => {
   const parsed = parseInt(value ?? '', 10);
   return Number.isFinite(parsed) ? parsed : fallback;
};

const parseOrigins = (value: string | undefined) =>
   (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

const authConfig = registerAs('auth', () => {
   const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? '1h';
   const accessTtlSec = parseDurationToSeconds(accessExpiresIn, 3600);

   const refreshTtlSec = parseIntSafe(
      process.env.AUTH_REFRESH_TOKEN_TTL_SEC,
      60 * 60 * 24 * 30,
   );

   const appLinkPaths = parseOrigins(process.env.AUTH_APP_LINK_PATHS);

   return {
      jwt: {
         accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
         accessExpiresIn,
         accessTtlSec,
         contextSecret:
            process.env.JWT_CONTEXT_SECRET ??
            process.env.JWT_ACCESS_SECRET ??
            '',
      },
      cookie: {
         secure: parseBool(process.env.AUTH_COOKIE_SECURE, false),
         domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
         sameSite: (process.env.AUTH_COOKIE_SAME_SITE ?? 'lax').toLowerCase(),
      },
      invite: {
         ttlHours: parseIntSafe(process.env.AUTH_INVITE_TTL_HOURS, 72),
      },
      challenge: {
         ttlMinutes: parseIntSafe(process.env.AUTH_CHALLENGE_TTL_MINUTES, 10),
         maxAttempts: parseIntSafe(process.env.AUTH_MAX_CHALLENGE_ATTEMPTS, 5),
      },
      refresh: {
         ttlSec: refreshTtlSec,
      },
      csrf: {
         ttlSec: parseIntSafe(process.env.AUTH_CSRF_TTL_SEC, refreshTtlSec),
      },
      association: {
         ios: {
            teamId: process.env.AUTH_IOS_TEAM_ID ?? '',
            bundleId: process.env.AUTH_IOS_BUNDLE_ID ?? '',
         },
         android: {
            packageName: process.env.AUTH_ANDROID_PACKAGE_NAME ?? '',
            sha256CertFingerprints: parseOrigins(
               process.env.AUTH_ANDROID_SHA256_CERT_FINGERPRINTS,
            ),
         },
         applinks: {
            paths:
               appLinkPaths.length > 0 ? appLinkPaths : ['/auth/login/magic*'],
         },
      },
      rateLimit: {
         windowSec: parseIntSafe(
            process.env.AUTH_RATE_LIMIT_WINDOW_SEC,
            10 * 60,
         ),
         maxAttempts: parseIntSafe(
            process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
            10,
         ),
      },
   };
});

export const authConfigValidation = z.object({
   JWT_ACCESS_SECRET: z.string().min(16),
   JWT_ACCESS_EXPIRES_IN: z.string().default('1h'),
   JWT_CONTEXT_SECRET: z.string().optional(),
   AUTH_REFRESH_TOKEN_TTL_SEC: z.coerce
      .number()
      .int()
      .positive()
      .default(2592000),
   AUTH_COOKIE_SECURE: z
      .enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])
      .optional(),
   AUTH_COOKIE_DOMAIN: z.string().optional(),
   AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
   AUTH_INVITE_TTL_HOURS: z.coerce.number().int().positive().default(72),
   AUTH_CHALLENGE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
   AUTH_MAX_CHALLENGE_ATTEMPTS: z.coerce.number().int().positive().default(5),
   AUTH_CSRF_TTL_SEC: z.coerce.number().int().positive().optional(),
   AUTH_IOS_TEAM_ID: z.string().optional().default(''),
   AUTH_IOS_BUNDLE_ID: z.string().optional().default(''),
   AUTH_ANDROID_PACKAGE_NAME: z.string().optional().default(''),
   AUTH_ANDROID_SHA256_CERT_FINGERPRINTS: z.string().optional().default(''),
   AUTH_APP_LINK_PATHS: z.string().optional().default('/auth/login/magic*'),
   AUTH_RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(600),
   AUTH_RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
});

export function validateAuthEnv(env: NodeJS.ProcessEnv) {
   try {
      return authConfigValidation.parse(env);
   } catch (error) {
      console.error('Falha na validação da configuração de auth:', error);
      throw error;
   }
}

export default authConfig;
