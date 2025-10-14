import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import logConfig, { validateLogEnv } from './logger.config';
import { MyLogger } from './my-logger.service';

validateLogEnv(process.env);

@Module({
   imports: [
      ConfigModule.forRoot({
         cache: true,
         load: [logConfig],
      }),
   ],
   providers: [MyLogger],
   exports: [MyLogger],
})
export class LoggerModule {}
