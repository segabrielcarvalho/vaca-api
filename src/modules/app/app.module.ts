import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';

import { AclModule } from '../acl/acl.module';
import correctionConfig, {
   validateCorrectionEnv,
} from '../correction/config/correction.config';
import { CorrectionModule } from '../correction/correction.module';
import { EmailModule } from '../email/email.module';
import { ExamModule } from '../exam/exam.module';
import { GraphQLModule } from '../graphql/graphql.module';
import authConfig, { validateAuthEnv } from '../auth/auth.config';
import { CourseModule } from '../course/course.module';
import { KlassModule } from '../klass/klass.module';
import { OmrTemplateModule } from '../omr-template/omr-template.module';

import prismaConfig, { validatePrismaEnv } from '../prisma/prisma.config';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { redisConfig, validateRedisEnv } from '../redis/config/redis.config';
import { RedisModule } from '../redis/redis.module';
import { SchoolModule } from '../school/school.module';
import storageConfig, { validateStorageEnv } from '../storage/storage.config';
import { StorageModule } from '../storage/storage.module';
import { StudentModule } from '../student/student.module';

import appConfig, { validateAppEnv } from './app.config';
import { AppResolver } from './app.resolver';
import { HealthController } from './health.controller';
import { WellKnownController } from './well-known.controller';

const validateEnv = (env: NodeJS.ProcessEnv) => {
   validateAppEnv(env);
   validateAuthEnv(env);
   validatePrismaEnv(env);
   validateStorageEnv(env);
   validateRedisEnv(env);
   validateCorrectionEnv(env);
   return env;
};

@Module({
   imports: [
      ConfigModule.forRoot({
         isGlobal: true,
         cache: true,
         load: [
            appConfig,
            authConfig,
            prismaConfig,
            storageConfig,
            redisConfig,
            correctionConfig,
         ],
         validate: validateEnv,
      }),
      PrismaModule,
      TerminusModule,
      GraphQLModule,

      RedisModule,
      StorageModule,
      QueueModule,
      EmailModule,
      AclModule,
      SchoolModule,
      CourseModule,
      KlassModule,
      StudentModule,
      OmrTemplateModule,
      ExamModule,
      CorrectionModule,
   ],
   controllers: [HealthController, WellKnownController],
   providers: [AppResolver],
})
export class AppModule {}
