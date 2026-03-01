import {
   AuthChallengeTypeEnum,
   AuthChannelEnum as PrismaAuthChannelEnum,
} from '../../../../../.prisma/client';
import {
   BadRequestException,
   Inject,
   Injectable,
   UnauthorizedException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { AuthCachedChallengeInput } from '../../input/auth-cached-challenge.input';
import authConfig from '../../auth.config';
import { createTokenHash } from '../../utils/auth-crypto.util';
import { AuthRedisService } from './auth-redis.service';

@Injectable()
export class AuthChallengeService {
   constructor(
      private readonly authRedisService: AuthRedisService,
      @Inject(authConfig.KEY)
      private readonly config: ConfigType<typeof authConfig>,
   ) {}

   getChallengeExpiration() {
      return new Date(
         Date.now() + this.config.challenge.ttlMinutes * 60 * 1000,
      );
   }

   async createChallenge(input: {
      type: AuthChallengeTypeEnum;
      channel: PrismaAuthChannelEnum;
      email?: string;
      userId?: string;
      inviteId?: string;
      codeHash?: string;
      tokenHash?: string;
      payload?: Record<string, unknown>;
      maxAttempts?: number;
      expiresAt: Date;
   }): Promise<AuthCachedChallengeInput> {
      const challenge = new AuthCachedChallengeInput();
      challenge.id = crypto.randomUUID();
      challenge.type = input.type;
      challenge.channel = input.channel;
      challenge.email = input.email ?? null;
      challenge.userId = input.userId ?? null;
      challenge.inviteId = input.inviteId ?? null;
      challenge.codeHash = input.codeHash ?? null;
      challenge.tokenHash = input.tokenHash ?? null;
      challenge.payload = input.payload ?? null;
      challenge.attempts = 0;
      challenge.maxAttempts =
         input.maxAttempts ?? this.config.challenge.maxAttempts;
      challenge.createdAt = new Date();
      challenge.expiresAt = input.expiresAt;
      challenge.consumedAt = null;

      await this.saveChallenge(challenge);
      return challenge;
   }

   async findById(input: {
      id: string;
      type?: AuthChallengeTypeEnum;
   }): Promise<AuthCachedChallengeInput | null> {
      const raw = await this.authRedisService.getJson<Record<string, unknown>>(
         this.challengeKey(input.id),
      );
      if (!raw) return null;

      const challenge = this.parseChallenge(raw);
      if (!challenge) return null;
      if (input.type && challenge.type !== input.type) return null;
      return challenge;
   }

   async findByTokenHash(input: {
      type: AuthChallengeTypeEnum;
      tokenHash: string;
   }): Promise<AuthCachedChallengeInput | null> {
      const challengeId = await this.authRedisService.getString(
         this.challengeTokenKey(input.type, input.tokenHash),
      );
      if (!challengeId) return null;
      return this.findById({ id: challengeId, type: input.type });
   }

   getChallengePayload(challenge: {
      payload: Record<string, unknown> | null;
   }): Record<string, unknown> {
      if (!challenge?.payload || typeof challenge.payload !== 'object') {
         return {};
      }
      return challenge.payload;
   }

   assertChallengeActive(
      challenge?: AuthCachedChallengeInput | null,
   ): asserts challenge {
      if (!challenge) {
         throw new UnauthorizedException('Desafio nao encontrado.');
      }

      if (challenge.consumedAt) {
         throw new UnauthorizedException('Desafio ja consumido.');
      }

      if (challenge.expiresAt.getTime() <= Date.now()) {
         throw new UnauthorizedException('Desafio expirado.');
      }

      if (challenge.attempts >= challenge.maxAttempts) {
         throw new UnauthorizedException(
            'Desafio bloqueado por excesso de tentativas.',
         );
      }
   }

   async verifyChallengeCode(
      challenge: AuthCachedChallengeInput | null,
      code: string,
   ) {
      this.assertChallengeActive(challenge);

      if (!challenge.codeHash) {
         throw new UnauthorizedException('Desafio sem codigo configurado.');
      }

      const isValid = createTokenHash(code) === challenge.codeHash;
      if (isValid) return true;

      challenge.attempts += 1;
      await this.saveChallenge(challenge);

      return false;
   }

   async consumeChallenge(challenge: AuthCachedChallengeInput) {
      challenge.consumedAt = new Date();
      await this.saveChallenge(challenge);
   }

   async assertRateLimit(input: {
      email: string;
      type: AuthChallengeTypeEnum;
      ip?: string;
      deviceId?: string;
   }) {
      const windowSec = this.config.rateLimit.windowSec;
      const emailHash = createTokenHash(input.email.toLowerCase());
      const ipHash = input.ip
         ? createTokenHash(this.normalizeRateLimitPart(input.ip))
         : undefined;

      await this.assertLimitByKey(
         this.rateLimitEmailKey(input.type, emailHash),
         windowSec,
      );

      if (ipHash) {
         await this.assertLimitByKey(
            this.rateLimitIpKey(input.type, ipHash),
            windowSec,
         );
         await this.assertLimitByKey(
            this.rateLimitEmailIpKey(input.type, emailHash, ipHash),
            windowSec,
         );
      }
   }

   private async saveChallenge(
      challenge: AuthCachedChallengeInput,
   ): Promise<void> {
      const ttlSec = Math.max(
         1,
         Math.ceil((challenge.expiresAt.getTime() - Date.now()) / 1000),
      );
      await this.authRedisService.setJson(
         this.challengeKey(challenge.id),
         {
            id: challenge.id,
            type: challenge.type,
            channel: challenge.channel,
            email: challenge.email,
            userId: challenge.userId,
            inviteId: challenge.inviteId,
            codeHash: challenge.codeHash,
            tokenHash: challenge.tokenHash,
            payload: challenge.payload,
            attempts: challenge.attempts,
            maxAttempts: challenge.maxAttempts,
            createdAt: challenge.createdAt.toISOString(),
            expiresAt: challenge.expiresAt.toISOString(),
            consumedAt: challenge.consumedAt
               ? challenge.consumedAt.toISOString()
               : null,
         },
         ttlSec,
      );

      if (challenge.tokenHash) {
         await this.authRedisService.setString(
            this.challengeTokenKey(challenge.type, challenge.tokenHash),
            challenge.id,
            ttlSec,
         );
      }
   }

   private parseChallenge(raw: Record<string, unknown>) {
      try {
         const challenge = new AuthCachedChallengeInput();
         challenge.id = String(raw.id);
         challenge.type = raw.type as AuthChallengeTypeEnum;
         challenge.channel = raw.channel as PrismaAuthChannelEnum;
         challenge.email = raw.email ? String(raw.email) : null;
         challenge.userId = raw.userId ? String(raw.userId) : null;
         challenge.inviteId = raw.inviteId ? String(raw.inviteId) : null;
         challenge.codeHash = raw.codeHash ? String(raw.codeHash) : null;
         challenge.tokenHash = raw.tokenHash ? String(raw.tokenHash) : null;
         challenge.payload =
            raw.payload && typeof raw.payload === 'object'
               ? (raw.payload as Record<string, unknown>)
               : null;
         challenge.attempts = Number(raw.attempts ?? 0);
         challenge.maxAttempts = Number(raw.maxAttempts ?? 0);
         challenge.createdAt = new Date(String(raw.createdAt));
         challenge.expiresAt = new Date(String(raw.expiresAt));
         challenge.consumedAt = raw.consumedAt
            ? new Date(String(raw.consumedAt))
            : null;
         return challenge;
      } catch {
         return null;
      }
   }

   private challengeKey(id: string) {
      return `auth:challenge:${id}`;
   }

   private challengeTokenKey(type: AuthChallengeTypeEnum, tokenHash: string) {
      return `auth:challenge:token:${type}:${tokenHash}`;
   }

   private rateLimitEmailKey(type: AuthChallengeTypeEnum, emailHash: string) {
      return `auth:rl:${type}:email:${emailHash}`;
   }

   private rateLimitIpKey(type: AuthChallengeTypeEnum, ipHash: string) {
      return `auth:rl:${type}:ip:${ipHash}`;
   }

   private rateLimitEmailIpKey(
      type: AuthChallengeTypeEnum,
      emailHash: string,
      ipHash: string,
   ) {
      return `auth:rl:${type}:email_ip:${emailHash}:${ipHash}`;
   }

   private async assertLimitByKey(key: string, ttlSec: number) {
      const attempts = await this.authRedisService.increment(key);
      if (attempts === 1) {
         await this.authRedisService.expire(key, ttlSec);
      }

      if (attempts > this.config.rateLimit.maxAttempts) {
         throw new BadRequestException(
            'Muitas tentativas. Aguarde alguns minutos para tentar novamente.',
         );
      }
   }

   private normalizeRateLimitPart(value?: string) {
      if (!value) return 'unknown';
      return value
         .trim()
         .toLowerCase()
         .replace(/[^a-z0-9:_-]+/gi, '-');
   }
}
