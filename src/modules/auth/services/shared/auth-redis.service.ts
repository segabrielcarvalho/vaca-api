import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_QUEUE_CLIENT } from '../../../redis/redis.constants';

@Injectable()
export class AuthRedisService {
   constructor(
      @Inject(REDIS_QUEUE_CLIENT)
      private readonly redis: Redis,
   ) {}

   async getString(key: string): Promise<string | null> {
      return this.redis.get(key);
   }

   async setString(key: string, value: string, ttlSec: number) {
      await this.redis.set(key, value, 'EX', ttlSec);
   }

   async increment(key: string): Promise<number> {
      return this.redis.incr(key);
   }

   async expire(key: string, ttlSec: number) {
      await this.redis.expire(key, ttlSec);
   }

   async getJson<T>(key: string): Promise<T | null> {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      try {
         return JSON.parse(raw) as T;
      } catch {
         return null;
      }
   }

   async setJson(key: string, value: unknown, ttlSec: number) {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSec);
   }
}
