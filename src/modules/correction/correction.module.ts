import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';
import correctionConfig from './config/correction.config';
import { CorrectionOmrProcessor } from './processors/correction-omr.processor';
import { CorrectionResolver } from './resolvers/correction.resolver';
import { CorrectionPublisherService } from './services/correction-publisher.service';
import { StartCorrectionSessionService } from './services/create/start-correction-session.service';
import { SubmitCorrectionPhotoService } from './services/create/submit-correction-photo.service';
import { ListCorrectionCapturesService } from './services/get/list-correction-captures.service';
import { ListExamCorrectionsService } from './services/get/list-exam-corrections.service';
import { CorrectionAccessService } from './services/shared/correction-access.service';
import { CorrectionMetricsService } from './services/shared/correction-metrics.service';
import { CorrectionRetentionService } from './services/shared/correction-retention.service';
import { CompleteCorrectionSessionService } from './services/update/complete-correction-session.service';
import { RequeueCorrectionCaptureService } from './services/update/requeue-correction-capture.service';
import { ResolveCorrectionCaptureService } from './services/update/resolve-correction-capture.service';

@Module({
   imports: [
      ConfigModule.forFeature(correctionConfig),
      PrismaModule,
      AuthModule,
      QueueModule,
      StorageModule,
      RedisModule,
   ],
   providers: [
      CorrectionResolver,
      CorrectionPublisherService,
      CorrectionAccessService,
      CorrectionMetricsService,
      CorrectionRetentionService,
      StartCorrectionSessionService,
      SubmitCorrectionPhotoService,
      CompleteCorrectionSessionService,
      ResolveCorrectionCaptureService,
      RequeueCorrectionCaptureService,
      ListCorrectionCapturesService,
      ListExamCorrectionsService,
      CorrectionOmrProcessor,
   ],
})
export class CorrectionModule {}
