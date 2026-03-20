import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { RedisPubSub } from 'graphql-redis-subscriptions';
import { Prisma } from '../../../../.prisma/client';
import correctionConfig from '../config/correction.config';
import { MyLogger } from '../../logger/my-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_PUBSUB } from '../../redis/redis.constants';

type PublishInput = {
   sessionId: string;
   captureId?: string;
   stage: string;
   durationMs?: number;
   payload?: Record<string, unknown>;
};

@Injectable()
export class CorrectionPublisherService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly logger: MyLogger,
      @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub,
      @Inject(correctionConfig.KEY)
      private readonly config: ConfigType<typeof correctionConfig>,
   ) {}

   topic(sessionId: string) {
      return `correction:session:${sessionId}`;
   }

   async publish(input: PublishInput) {
      this.logger.setContext(CorrectionPublisherService.name);
      if (this.config.debugTrace) {
         this.logger.setLogLevels(['log', 'error', 'warn', 'debug', 'verbose']);
      }
      this.trace('correction_event.publish_started', {
         sessionId: input.sessionId,
         captureId: input.captureId,
         stage: input.stage,
         durationMs: input.durationMs,
      });

      const event = await this.prisma.correctionSessionEvent.create({
         data: {
            sessionId: input.sessionId,
            captureId: input.captureId,
            stage: input.stage,
            durationMs: input.durationMs,
            payload: input.payload ? this.toJson(input.payload) : undefined,
         },
      });

      this.trace('correction_event.persisted', {
         eventId: event.id,
         sessionId: event.sessionId,
         captureId: event.captureId,
         stage: event.stage,
      });

      try {
         await this.pubSub.publish(this.topic(input.sessionId), {
            correctionSessionEvents: event,
         });
      } catch (error) {
         this.logger.warn(
            'Falha ao publicar evento de correção no pubsub',
            JSON.stringify({
               eventId: event.id,
               sessionId: event.sessionId,
               captureId: event.captureId,
               stage: event.stage,
               error: (error as Error).message,
            }),
         );
         this.trace('correction_event.pubsub_publish_failed', {
            eventId: event.id,
            sessionId: event.sessionId,
            captureId: event.captureId,
            stage: event.stage,
            error: (error as Error).message,
         });
         return event;
      }

      this.trace('correction_event.pubsub_published', {
         eventId: event.id,
         sessionId: event.sessionId,
         captureId: event.captureId,
         stage: event.stage,
      });

      return event;
   }

   private toJson(value: unknown): Prisma.InputJsonValue {
      return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
   }

   private trace(event: string, meta?: Record<string, unknown>) {
      if (!this.config.debugTrace) return;
      this.logger.debug(event, JSON.parse(JSON.stringify(meta ?? null)) as any);
   }
}
