import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const createTokenHash = (value: string) =>
   createHash('sha256').update(value).digest('hex');

export const generateRandomToken = (size = 32) =>
   randomBytes(size).toString('base64url');

export const generateOtpCode = () =>
   `${Math.floor(100000 + Math.random() * 900000)}`;

export const safeTokenEquals = (leftHash: string, rightRaw: string) => {
   const rightHash = createTokenHash(rightRaw);
   const leftBuffer = Buffer.from(leftHash);
   const rightBuffer = Buffer.from(rightHash);
   if (leftBuffer.length !== rightBuffer.length) return false;
   return timingSafeEqual(leftBuffer, rightBuffer);
};

export const maskEmail = (email: string) => {
   const [local, domain = ''] = email.split('@');
   if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
   return `${local.slice(0, 2)}***@${domain}`;
};

export const parseNotificationPrefs = (value: string) => {
   try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return parsed;
   } catch {
      return null;
   }
   return null;
};

export const isE164Phone = (value: string) => /^\+[1-9]\d{7,14}$/.test(value);
