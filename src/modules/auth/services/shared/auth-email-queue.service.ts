import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EMAIL_QUEUE_JOB } from '../../../email/queues/email-queue.constants';
import type { EmailQueuePayload } from '../../../email/queues/email-queue.constants';
import QUEUES from '../../../queue/constants/queue.constants';

@Injectable()
export class AuthEmailQueueService {
   constructor(
      @InjectQueue(QUEUES.EMAIL)
      private readonly emailQueue: Queue<EmailQueuePayload>,
   ) {}

   async run(input: EmailQueuePayload) {
      await this.emailQueue.add(EMAIL_QUEUE_JOB.SEND, input, {
         removeOnComplete: true,
         removeOnFail: 100,
      });
   }
}
