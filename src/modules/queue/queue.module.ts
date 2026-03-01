import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module';
import QUEUES from './constants/queue.constants';
import { QueueMaintenanceService } from './queue-maintenance.service';

const queueRegistrations = Object.values(QUEUES).map((queueName) =>
   BullModule.registerQueue({ name: queueName }),
);

@Module({
   imports: [RedisModule, ...queueRegistrations],
   providers: [QueueMaintenanceService],
   exports: [BullModule],
})
export class QueueModule {}
