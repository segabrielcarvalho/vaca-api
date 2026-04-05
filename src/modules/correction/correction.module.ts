import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { LoggerModule } from '../logger/logger.module';
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
import { GetCorrectionDashboardService } from './services/get/get-correction-dashboard.service';
import { GetCorrectionCaptureReviewService } from './services/get/get-correction-capture-review.service';
import { ListCorrectionCapturesService } from './services/get/list-correction-captures.service';
import { ListExamCorrectionSessionsService } from './services/get/list-exam-correction-sessions.service';
import { ListExamCorrectionsService } from './services/get/list-exam-corrections.service';
import { ListExamPendingStudentCapturesService } from './services/get/list-exam-pending-student-captures.service';
import { CorrectionAccessService } from './services/shared/correction-access.service';
import { CorrectionCaptureArtifactCleanupService } from './services/shared/correction-capture-artifact-cleanup.service';
import { CorrectionExamActivationService } from './services/shared/correction-exam-activation.service';
import { CorrectionMetricsService } from './services/shared/correction-metrics.service';
import { CorrectionReviewGradingService } from './services/shared/correction-review-grading.service';
import { CorrectionRetentionService } from './services/shared/correction-retention.service';
import { CompleteCorrectionSessionService } from './services/update/complete-correction-session.service';
import { FinalizeCorrectionCaptureReviewService } from './services/update/finalize-correction-capture-review.service';
import { RequeueCorrectionCaptureService } from './services/update/requeue-correction-capture.service';
import { ResolveCorrectionCaptureService } from './services/update/resolve-correction-capture.service';
import { SaveCorrectionCaptureReviewDraftService } from './services/update/save-correction-capture-review-draft.service';
import { CorrectionCaptureFieldsResolver } from './resolvers/correction-capture-fields.resolver';

@Module({
   imports: [
      ConfigModule.forFeature(correctionConfig),
      PrismaModule,
      AuthModule,
      LoggerModule,
      QueueModule,
      StorageModule,
      RedisModule,
   ],
   providers: [
      CorrectionResolver,
      CorrectionCaptureFieldsResolver,
      CorrectionPublisherService,
      CorrectionAccessService,
      CorrectionCaptureArtifactCleanupService,
      CorrectionExamActivationService,
      CorrectionMetricsService,
      CorrectionReviewGradingService,
      CorrectionRetentionService,
      StartCorrectionSessionService,
      SubmitCorrectionPhotoService,
      CompleteCorrectionSessionService,
      ResolveCorrectionCaptureService,
      RequeueCorrectionCaptureService,
      SaveCorrectionCaptureReviewDraftService,
      FinalizeCorrectionCaptureReviewService,
      ListCorrectionCapturesService,
      GetCorrectionDashboardService,
      GetCorrectionCaptureReviewService,
      ListExamCorrectionSessionsService,
      ListExamCorrectionsService,
      ListExamPendingStudentCapturesService,
      CorrectionOmrProcessor,
   ],
})
export class CorrectionModule {}
