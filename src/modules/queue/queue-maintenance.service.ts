import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import QUEUES from './constants/queue.constants';

const parseBoolean = (value: string | undefined) => {
   if (!value) return undefined;
   const normalized = value.trim().toLowerCase();
   if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
   if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
   return undefined;
};

@Injectable()
export class QueueMaintenanceService implements OnModuleInit {
   private readonly logger = new Logger(QueueMaintenanceService.name);

   constructor(
      @InjectQueue(QUEUES.DEFAULT)
      private readonly defaultQueue: Queue,
      @InjectQueue(QUEUES.EMAIL)
      private readonly emailQueue: Queue,
      @InjectQueue(QUEUES.CORRECTION_OMR)
      private readonly correctionOmrQueue: Queue,
      @InjectQueue(QUEUES.OMR_TEMPLATE_PDF)
      private readonly omrTemplatePdfQueue: Queue,
   ) {}

   async onModuleInit() {
      const cleanFlag = parseBoolean(process.env.QUEUE_CLEAN_ON_STARTUP);
      const nodeEnv = process.env.NODE_ENV ?? 'production';
      const shouldClean =
         cleanFlag === true ||
         (cleanFlag === undefined && nodeEnv === 'development');

      if (!shouldClean) return;

      await Promise.all([
         this.cleanQueue(this.defaultQueue, QUEUES.DEFAULT),
         this.cleanQueue(this.emailQueue, QUEUES.EMAIL),
         ...(cleanFlag === true
            ? [this.cleanQueue(this.correctionOmrQueue, QUEUES.CORRECTION_OMR)]
            : []),
         this.cleanQueue(this.omrTemplatePdfQueue, QUEUES.OMR_TEMPLATE_PDF),
      ]);
   }

   private async cleanQueue(queue: Queue, name: string) {
      try {
         const counts = await queue.getJobCounts(
            'active',
            'delayed',
            'failed',
            'wait',
            'paused',
            'completed',
         );
         const total = Object.values(counts).reduce(
            (sum, value) => sum + value,
            0,
         );
         if (total === 0) return;

         this.logger.warn(
            `Limpando fila BullMQ "${name}" na inicializacao (dev).`,
         );
         await queue.obliterate({ force: true });
      } catch (error) {
         this.logger.error(
            `Falha ao limpar a fila BullMQ "${name}".`,
            (error as Error).stack,
         );
      }
   }
}
