import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { REDIS_QUEUE_CLIENT } from '../redis/redis.constants';
import { RedisModule } from '../redis/redis.module';
import QUEUES from './constants/queue.constants';

const queueRegistrations = Object.values(QUEUES).map((queueName) =>
   BullModule.registerQueue({ name: queueName }),
);

@Module({
   imports: [
      RedisModule,
      ConfigModule.forRoot({
         cache: true,
      }),

      BullModule.forRootAsync({
         imports: [RedisModule],
         useFactory: (redisClient) => ({ connection: redisClient }),
         inject: [REDIS_QUEUE_CLIENT],
      }),

      PrismaModule,

      ...queueRegistrations,
   ],
   providers: [],
   exports: [BullModule],
})
export class QueueModule {}
