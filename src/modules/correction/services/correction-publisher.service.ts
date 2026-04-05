import { Inject, Injectable } from '@nestjs/common';
import type { RedisPubSub } from 'graphql-redis-subscriptions';
import { Prisma } from '../../../../.prisma/client';
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
   ) {}

   topic(sessionId: string) {
      return `correction:session:${sessionId}`;
   }

   async publish(input: PublishInput) {
      this.logger.setContext(CorrectionPublisherService.name);

      const event = await this.prisma.correctionSessionEvent.create({
         data: {
            sessionId: input.sessionId,
            captureId: input.captureId,
            stage: input.stage,
            durationMs: input.durationMs,
            payload: input.payload ? this.toJson(input.payload) : undefined,
         },
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
         return event;
      }

      return event;
   }

   private toJson(value: unknown): Prisma.InputJsonValue {
      return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
   }
}
