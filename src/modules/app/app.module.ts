import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '../graphql/graphql.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';
import appConfig, { validateAppEnv } from './app.config';
import { AppResolver } from './app.resolver';
import { HealthController } from './health.controller';

@Module({
   imports: [
      ConfigModule.forRoot({
         cache: true,
         load: [appConfig],
         validate: validateAppEnv,
      }),
      PrismaModule,
      GraphQLModule,
      RedisModule,
      StorageModule,
   ],
   controllers: [HealthController],
   providers: [AppResolver],
})
export class AppModule {}
