import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MenteeUsageLimitModule } from '../chat/mentee-usage-limit/mentee-usage-limit.module';
import { EmailModule } from '../email/email.module';
import { IgdAgentsOpenAiModule } from '../igd-agents-open-ai/igd-agents-open-ai.module';
import { LoggerModule } from '../logger/logger.module';
import { OpenAiModule } from '../open-ai/open-ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QDrantModule } from '../qdrant/qdrant.module';
import { REDIS_QUEUE_CLIENT } from '../redis/redis.constants';
import { RedisModule } from '../redis/redis.module';
import QUEUES from './constants/queue.constants';
import { EmailProcessor } from './processors/email.processor';
import { MessagesProcessor } from './processors/messages.processor';
import { SessionProcessor } from './processors/session.processor';
import { UpdateMenteeLimitProcessor } from './processors/update-mentee-limit';
import { CheckMenteeUsageLimit } from './services/check-mentee-limit/check-mentee-limit.service';

const queueRegistrations = Object.values(QUEUES).map((queueName) =>
   BullModule.registerQueue({ name: queueName }),
);

@Module({
   imports: [
      RedisModule,
      MenteeUsageLimitModule,
      OpenAiModule,
      IgdAgentsOpenAiModule,
      QDrantModule,
      ConfigModule.forRoot({
         cache: true,
      }),

      BullModule.forRootAsync({
         imports: [RedisModule],
         useFactory: (redisClient) => ({ connection: redisClient }),
         inject: [REDIS_QUEUE_CLIENT],
      }),

      EmailModule,
      PrismaModule,
      LoggerModule,

      ...queueRegistrations,
   ],
   providers: [
      CheckMenteeUsageLimit,

      EmailProcessor,
      MessagesProcessor,
      SessionProcessor,
      UpdateMenteeLimitProcessor,
   ],
   exports: [BullModule],
})
export class QueueModule {}
