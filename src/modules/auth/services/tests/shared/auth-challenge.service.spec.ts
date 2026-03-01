import { BadRequestException } from '@nestjs/common';
import { AuthChallengeTypeEnum } from '../../../../../../.prisma/client';
import { AuthChallengeService } from '../../shared/auth-challenge.service';

class FakeAuthRedisService {
   private readonly counters = new Map<string, number>();
   private readonly expirations = new Map<string, number>();
   private nowMs = Date.now();

   async increment(key: string): Promise<number> {
      this.cleanupExpired();
      const current = this.counters.get(key) ?? 0;
      const next = current + 1;
      this.counters.set(key, next);
      return next;
   }

   async expire(key: string, ttlSec: number): Promise<void> {
      this.expirations.set(key, this.nowMs + ttlSec * 1000);
   }

   advance(ms: number): void {
      this.nowMs += ms;
      this.cleanupExpired();
   }

   private cleanupExpired() {
      for (const [key, expiresAt] of this.expirations.entries()) {
         if (expiresAt <= this.nowMs) {
            this.expirations.delete(key);
            this.counters.delete(key);
         }
      }
   }
}

describe('AuthChallengeService - RateLimit', () => {
   const createService = (redis: FakeAuthRedisService) =>
      new AuthChallengeService(
         redis as any,
         {
            challenge: {
               ttlMinutes: 10,
               maxAttempts: 5,
            },
            rateLimit: {
               windowSec: 60,
               maxAttempts: 1,
            },
         } as any,
      );

   it('deve bloquear por email mesmo trocando deviceId', async () => {
      const redis = new FakeAuthRedisService();
      const service = createService(redis);

      await service.assertRateLimit({
         email: 'professor@school.com',
         type: AuthChallengeTypeEnum.login_email,
         deviceId: 'device-1',
      });

      await expect(
         service.assertRateLimit({
            email: 'professor@school.com',
            type: AuthChallengeTypeEnum.login_email,
            deviceId: 'device-2',
         }),
      ).rejects.toThrow(BadRequestException);
   });

   it('deve bloquear por ip mesmo mudando email/deviceId', async () => {
      const redis = new FakeAuthRedisService();
      const service = createService(redis);

      await service.assertRateLimit({
         email: 'user1@school.com',
         ip: '10.0.0.1',
         type: AuthChallengeTypeEnum.login_email,
         deviceId: 'device-a',
      });

      await expect(
         service.assertRateLimit({
            email: 'user2@school.com',
            ip: '10.0.0.1',
            type: AuthChallengeTypeEnum.login_email,
            deviceId: 'device-b',
         }),
      ).rejects.toThrow(BadRequestException);
   });

   it('deve liberar novamente apos expirar a janela', async () => {
      const redis = new FakeAuthRedisService();
      const service = createService(redis);

      await service.assertRateLimit({
         email: 'coordenador@school.com',
         type: AuthChallengeTypeEnum.login_email,
         deviceId: 'device-1',
      });

      await expect(
         service.assertRateLimit({
            email: 'coordenador@school.com',
            type: AuthChallengeTypeEnum.login_email,
            deviceId: 'device-2',
         }),
      ).rejects.toThrow(BadRequestException);

      redis.advance(61_000);

      await expect(
         service.assertRateLimit({
            email: 'coordenador@school.com',
            type: AuthChallengeTypeEnum.login_email,
            deviceId: 'device-3',
         }),
      ).resolves.toBeUndefined();
   });
});
