import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';
import { redisConfig } from './config/redis.config';
import { REDIS_PUBSUB, REDIS_QUEUE_CLIENT } from './redis.constants';

@Global()
@Module({
   imports: [
      ConfigModule,
      BullModule.forRootAsync({
         imports: [ConfigModule],
         inject: [redisConfig.KEY],
         useFactory: (config: ConfigType<typeof redisConfig>) => {
            const retryStrategy = (times: number) => {
               if (times > (config.maxRetries ?? 10)) return null;
               return Math.min(times * 200, 2000);
            };
            const base = {
               host: config.host,
               port: config.port,
               username: config.username,
               password: config.password,
               connectTimeout: config.connectTimeout,
               keepAlive: config.keepAlive,
               maxRetriesPerRequest: config.maxRetriesPerRequest ?? null,
               keyPrefix: config.keyPrefix,
            };
            const { keyPrefix, ...baseWithoutPrefix } = base;
            const bullPrefix = keyPrefix
               ? `${keyPrefix.replace(/:+$/, '')}:bull`
               : undefined;
            return {
               prefix: bullPrefix,
               connection: {
                  ...baseWithoutPrefix,
                  db: config.db.queue ?? 0,
                  maxRetriesPerRequest: null,
                  enableReadyCheck: false,
                  retryStrategy,
               },
            };
         },
      }),
   ],

   providers: [
      {
         provide: REDIS_QUEUE_CLIENT,
         inject: [redisConfig.KEY],
         useFactory: (config: ConfigType<typeof redisConfig>) => {
            const retryStrategy = (times: number) => {
               if (times > (config.maxRetries ?? 10)) return null;
               return Math.min(times * 200, 2000);
            };
            const base = {
               host: config.host,
               port: config.port,
               username: config.username,
               password: config.password,
               connectTimeout: config.connectTimeout,
               keepAlive: config.keepAlive,
               maxRetriesPerRequest: config.maxRetriesPerRequest ?? null,
               enableReadyCheck: false,
               keyPrefix: config.keyPrefix,
               retryStrategy,
            };
            return new Redis({ ...base, db: config.db.queue ?? 0 });
         },
      },

      {
         provide: REDIS_PUBSUB,
         inject: [redisConfig.KEY],
         useFactory: (config: ConfigType<typeof redisConfig>) => {
            const retryStrategy = (times: number) => {
               if (times > (config.maxRetries ?? 10)) return null;
               return Math.min(times * 200, 2000);
            };
            const base = {
               host: config.host,
               port: config.port,
               username: config.username,
               password: config.password,
               connectTimeout: config.connectTimeout,
               keepAlive: config.keepAlive,
               maxRetriesPerRequest: config.maxRetriesPerRequest ?? null,
               enableReadyCheck: false,
               keyPrefix: config.keyPrefix,
               retryStrategy,
               db: config.db.ws ?? 1,
            };
            const publisher = new Redis(base);
            const subscriber = new Redis(base);
            return new RedisPubSub({ publisher, subscriber });
         },
      },
   ],
   exports: [BullModule, REDIS_QUEUE_CLIENT, REDIS_PUBSUB],
})
export class RedisModule {}
