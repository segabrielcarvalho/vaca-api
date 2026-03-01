import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import emailConfig, { validateEmailEnv } from './email.config';
import EmailProvider from './provider';
import { EmailQueueProcessor } from './queues/email-queue.processor';

@Module({
   imports: [
      ConfigModule.forRoot({
         cache: true,
         load: [emailConfig],
         validate: validateEmailEnv,
      }),
      PrismaModule,
      QueueModule,
   ],
   providers: [EmailProvider, EmailQueueProcessor],
   exports: [EmailProvider],
})
export class EmailModule {}
