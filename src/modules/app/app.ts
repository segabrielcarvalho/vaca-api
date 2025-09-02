import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import express from 'express';

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueueToken } from '@nestjs/bullmq';
import { NestExpressApplication } from '@nestjs/platform-express';
import { graphqlUploadExpress } from 'graphql-upload';
import { MyLogger } from '../logger/my-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import QUEUES from '../queue/constants/queue.constants';
import { AppModule } from './app.module';

async function getApp() {
   const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bufferLogs: true,
      bodyParser: false,
   });

   app.useBodyParser('json', { limit: '10mb' });
   app.useBodyParser('urlencoded', { extended: true, limit: '10mb' });

   app.use(
      '/graphql',
      graphqlUploadExpress({
         maxFiles: 10,
         maxFileSize: 50 * 1024 * 1024,
      }),
   );

   const logger = await app.resolve(MyLogger);
   app.useLogger(logger);

   const config = app.get(ConfigService);

   const frontUrl = config.get<string>('app.baseWebUrl');


   app.enableCors({
      origin: [frontUrl],
      credentials: true,
   });

   app.useGlobalPipes(
      new ValidationPipe({
         transform: true,
         transformOptions: {
            enableImplicitConversion: true,
            enableCircularCheck: true,
         },
      }),
   );
   app.use(cookieParser());

   app.use(express.json({ limit: '10mb' }));

   app.use(express.urlencoded({ limit: '10mb', extended: true }));

   app.setGlobalPrefix('api');

   const serverAdapter = new ExpressAdapter();

   serverAdapter.setBasePath('/admin/queues');

   const emailsQueue = app.get(getQueueToken(QUEUES.EMAILS));

   const sessionsQueue = app.get(getQueueToken(QUEUES.SESSIONS));

   const messagesQueue = app.get(getQueueToken(QUEUES.MESSAGES));

   const menteeLimitsQueue = app.get(getQueueToken(QUEUES.MENTEE_LIMITS));

   createBullBoard({
      queues: [
         new BullMQAdapter(emailsQueue),
         new BullMQAdapter(sessionsQueue),
         new BullMQAdapter(messagesQueue),
         new BullMQAdapter(menteeLimitsQueue),
      ],
      serverAdapter,
   });

   app.use('/admin/queues', serverAdapter.getRouter());

   const prismaService = app.get(PrismaService);
   await prismaService.enableShutdownHooks();

   return app;
}

export default getApp;
