import { Inject, Injectable } from '@nestjs/common';
import type { RedisPubSub } from 'graphql-redis-subscriptions';
import { Prisma } from '../../../../.prisma/client';
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
      @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub,
   ) {}

   topic(sessionId: string) {
      return `correction:session:${sessionId}`;
   }

   async publish(input: PublishInput) {
      const event = await this.prisma.correctionSessionEvent.create({
         data: {
            sessionId: input.sessionId,
            captureId: input.captureId,
            stage: input.stage,
            durationMs: input.durationMs,
            payload: input.payload ? this.toJson(input.payload) : undefined,
         },
      });

      await this.pubSub.publish(this.topic(input.sessionId), {
         correctionSessionEvents: event,
      });

      return event;
   }

   private toJson(value: unknown): Prisma.InputJsonValue {
      return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
   }
}
