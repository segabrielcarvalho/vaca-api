import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import IEmailProvider from '../provider/IEmailProvider';
import QUEUES from '../../queue/constants/queue.constants';
import type { EmailQueuePayload } from './email-queue.constants';

@Processor(QUEUES.EMAIL)
export class EmailQueueProcessor extends WorkerHost {
   constructor(
      @Inject('EmailProvider') private readonly emailProvider: IEmailProvider,
   ) {
      super();
   }

   async process(job: Job<EmailQueuePayload>) {
      await this.emailProvider.sendEmail(job.data);
   }
}
