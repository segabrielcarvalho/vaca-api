import { Inject } from '@nestjs/common';
import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import type { RedisPubSub } from 'graphql-redis-subscriptions';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { CorrectionCapture } from '../../graphql/@generated/correction-capture/correction-capture.model';
import { CorrectionSession } from '../../graphql/@generated/correction-session/correction-session.model';
import { CorrectionSessionEvent } from '../../graphql/@generated/correction-session-event/correction-session-event.model';
import { REDIS_PUBSUB } from '../../redis/redis.constants';
import { CorrectionEventStageEnum } from '../enums/correction-event-stage.enum';
import { CompleteCorrectionSessionInput } from '../inputs/complete-correction-session.input';
import { ListCorrectionCapturesInput } from '../inputs/list-correction-captures.input';
import { ListExamCorrectionSessionsInput } from '../inputs/list-exam-correction-sessions.input';
import { ListExamCorrectionsInput } from '../inputs/list-exam-corrections.input';
import { ListExamPendingStudentCapturesInput } from '../inputs/list-exam-pending-student-captures.input';
import { RequeueCorrectionCaptureInput } from '../inputs/requeue-correction-capture.input';
import { ResolveCorrectionCaptureInput } from '../inputs/resolve-correction-capture.input';
import { StartCorrectionSessionInput } from '../inputs/start-correction-session.input';
import { SubmitCorrectionPhotoInput } from '../inputs/submit-correction-photo.input';
import { CorrectionCaptureListObject } from '../objects/correction-capture-list.object';
import { CorrectionExamListObject } from '../objects/correction-exam-list.object';
import { ExamPendingStudentCaptureListObject } from '../objects/exam-pending-student-capture-list.object';
import { CorrectionSessionListObject } from '../objects/correction-session-list.object';
import { CorrectionPublisherService } from '../services/correction-publisher.service';
import { StartCorrectionSessionService } from '../services/create/start-correction-session.service';
import { SubmitCorrectionPhotoService } from '../services/create/submit-correction-photo.service';
import { ListCorrectionCapturesService } from '../services/get/list-correction-captures.service';
import { ListExamCorrectionSessionsService } from '../services/get/list-exam-correction-sessions.service';
import { ListExamCorrectionsService } from '../services/get/list-exam-corrections.service';
import { ListExamPendingStudentCapturesService } from '../services/get/list-exam-pending-student-captures.service';
import { CompleteCorrectionSessionService } from '../services/update/complete-correction-session.service';
import { RequeueCorrectionCaptureService } from '../services/update/requeue-correction-capture.service';
import { ResolveCorrectionCaptureService } from '../services/update/resolve-correction-capture.service';

type CorrectionSessionEventPayload = {
   correctionSessionEvents?: CorrectionSessionEvent;
};

function normalizeCorrectionSessionEventDate(
   payload: CorrectionSessionEventPayload,
): CorrectionSessionEventPayload {
   const event = payload?.correctionSessionEvents;
   if (!event || event.createdAt instanceof Date) {
      return payload;
   }

   return {
      correctionSessionEvents: {
         ...event,
         createdAt: new Date(event.createdAt),
      },
   };
}

@Resolver()
export class CorrectionResolver {
   constructor(
      private readonly startCorrectionSessionService: StartCorrectionSessionService,
      private readonly submitCorrectionPhotoService: SubmitCorrectionPhotoService,
      private readonly completeCorrectionSessionService: CompleteCorrectionSessionService,
      private readonly resolveCorrectionCaptureService: ResolveCorrectionCaptureService,
      private readonly requeueCorrectionCaptureService: RequeueCorrectionCaptureService,
      private readonly listCorrectionCapturesService: ListCorrectionCapturesService,
      private readonly listExamCorrectionSessionsService: ListExamCorrectionSessionsService,
      private readonly listExamCorrectionsService: ListExamCorrectionsService,
      private readonly listExamPendingStudentCapturesService: ListExamPendingStudentCapturesService,
      private readonly publisher: CorrectionPublisherService,
      @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub,
   ) {}

   @Mutation(() => CorrectionSession)
   async startCorrectionSession(
      @Args('input') input: StartCorrectionSessionInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.startCorrectionSessionService.run(input, user);
   }

   @Mutation(() => CorrectionCapture)
   async submitCorrectionPhoto(
      @Args('input') input: SubmitCorrectionPhotoInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.submitCorrectionPhotoService.run(input, user);
   }

   @Mutation(() => CorrectionSession)
   async completeCorrectionSession(
      @Args('input') input: CompleteCorrectionSessionInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.completeCorrectionSessionService.run(input, user);
   }

   @Mutation(() => CorrectionCapture)
   async resolveCorrectionCapture(
      @Args('input') input: ResolveCorrectionCaptureInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.resolveCorrectionCaptureService.run(input, user);
   }

   @Mutation(() => CorrectionCapture)
   async requeueCorrectionCapture(
      @Args('input') input: RequeueCorrectionCaptureInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.requeueCorrectionCaptureService.run(input, user);
   }

   @Query(() => CorrectionCaptureListObject)
   async listCorrectionCaptures(
      @Args('input') input: ListCorrectionCapturesInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.listCorrectionCapturesService.run(input, user);
   }

   @Query(() => CorrectionExamListObject)
   async listExamCorrections(
      @Args('input') input: ListExamCorrectionsInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.listExamCorrectionsService.run(input, user);
   }

   @Query(() => ExamPendingStudentCaptureListObject)
   async listExamPendingStudentCaptures(
      @Args('input') input: ListExamPendingStudentCapturesInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.listExamPendingStudentCapturesService.run(input, user);
   }

   @Query(() => CorrectionSessionListObject)
   async listExamCorrectionSessions(
      @Args('input') input: ListExamCorrectionSessionsInput,
      @CurrentUser() user: AuthCurrentUser,
   ) {
      return this.listExamCorrectionSessionsService.run(input, user);
   }

   @Subscription(() => CorrectionSessionEvent, {
      filter: (payload, variables) =>
         payload?.correctionSessionEvents?.sessionId === variables.sessionId,
      resolve: (payload) =>
         normalizeCorrectionSessionEventDate(payload).correctionSessionEvents,
   })
   correctionSessionEvents(@Args('sessionId') sessionId: string) {
      return this.pubSub.asyncIterator(
         this.publisher.topic(sessionId),
      ) as AsyncIterable<{
         correctionSessionEvents: CorrectionSessionEvent;
      }>;
   }

   @Query(() => [String])
   correctionEventStages() {
      return Object.values(CorrectionEventStageEnum);
   }
}

export { normalizeCorrectionSessionEventDate };
