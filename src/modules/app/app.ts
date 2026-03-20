import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { NestExpressApplication } from '@nestjs/platform-express';
import { MyLogger } from '../logger/my-logger.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from './app.module';

async function getApp() {
   const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bufferLogs: true,
      bodyParser: false,
   });

   app.useBodyParser('json', { limit: '10mb' });
   app.useBodyParser('urlencoded', { extended: true, limit: '10mb' });

   app.use(helmet({ contentSecurityPolicy: false }));

   const configService = app.get(ConfigService);
   const appLogger = app.get(MyLogger);
   if (configService.get<boolean>('correction.debugTrace')) {
      appLogger.setLogLevels(['log', 'error', 'warn', 'debug', 'verbose']);
   }
   app.useLogger(appLogger);
   const frontUrl = configService.get<string>('app.baseWebUrl');
   const adminUrl = configService.get<string>('app.baseAdminUrl');

   const allowedOrigins = [frontUrl, adminUrl].filter(Boolean);
   app.enableCors({
      origin: allowedOrigins,
      credentials: true,
   });

   app.useGlobalPipes(
      new ValidationPipe({
         transform: true,
         whitelist: false,
         forbidNonWhitelisted: false,
         forbidUnknownValues: false,
         transformOptions: {
            enableImplicitConversion: true,
            enableCircularCheck: true,
         },
      }),
   );
   app.use(cookieParser());

   app.setGlobalPrefix('api', {
      exclude: [
         {
            path: '.well-known/apple-app-site-association',
            method: RequestMethod.GET,
         },
         { path: '.well-known/assetlinks.json', method: RequestMethod.GET },
      ],
   });

   const prismaService = app.get(PrismaService);
   await prismaService.enableShutdownHooks();

   return app;
}

export default getApp;
