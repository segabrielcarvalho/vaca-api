import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';
import { REDIS_PUBSUB, REDIS_QUEUE_CLIENT } from './redis.constants';

@Global()
@Module({
   imports: [
      ConfigModule,
      BullModule.forRootAsync({
         imports: [ConfigModule],
         inject: [ConfigService],
         useFactory: (config: ConfigService) => ({
            connection: {
               ...config.get('redis'),
               db: 0,
               maxRetriesPerRequest: null,
               enableReadyCheck: false,
            },
         }),
      }),
   ],

   providers: [
      {
         provide: REDIS_QUEUE_CLIENT,
         inject: [ConfigService],
         useFactory: (config: ConfigService) =>
            new Redis({
               ...config.get('redis'),
               db: 0,
               maxRetriesPerRequest: null,
               enableReadyCheck: false,
            }),
      },

      {
         provide: REDIS_PUBSUB,
         inject: [ConfigService],
         useFactory: (config: ConfigService) => {
            const base = { ...config.get('redis'), db: 1 };
            const publisher = new Redis(base);
            const subscriber = new Redis(base);
            return new RedisPubSub({ publisher, subscriber });
         },
      },
   ],
   exports: [BullModule, REDIS_QUEUE_CLIENT, REDIS_PUBSUB],
})
export class RedisModule {}
