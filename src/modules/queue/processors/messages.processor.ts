import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import {
   Inject,
   Injectable,
   InternalServerErrorException,
} from '@nestjs/common';
import { MessageRoleEnum, Prisma, RoleEnum } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PubSub } from 'graphql-subscriptions';
import { Responses } from 'openai/resources/index';
import { S_MESSAGE_ADDED } from '../../chat/message/constants/subscription';
import { IgdAgentsOpenAiProvider } from '../../igd-agents-open-ai/provider/igd-agents-open-ai.provider';
import { MyLogger } from '../../logger/my-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_PUBSUB } from '../../redis/redis.constants';
import PROCESSORS from '../constants/processor.constants';
import QUEUES from '../constants/queue.constants';
import { CheckMenteeUsageLimit } from '../services/check-mentee-limit/check-mentee-limit.service';

export interface Payload {
   sessionId: string;
   agentId: string;
   originalContent: string;
   userId: string;
   role: RoleEnum;
   userMessageId: string;
}

@Processor(QUEUES.MESSAGES, { concurrency: 50 })
@Injectable()
export class MessagesProcessor extends WorkerHost {
   constructor(
      private readonly logger: MyLogger,
      private readonly prisma: PrismaService,
      private readonly igd: IgdAgentsOpenAiProvider,
      private readonly checkMenteeUsageLimit: CheckMenteeUsageLimit,
      @InjectQueue(QUEUES.MENTEE_LIMITS)
      private readonly menteeLimitsQueue: Queue,
      @Inject(REDIS_PUBSUB) private readonly pubSub: PubSub,
   ) {
      super();
   }
   async process(job: Job<Payload>) {
      const {
         sessionId,
         agentId,
         originalContent,
         userId,
         role,
         userMessageId,
      } = job.data;

      const [valid, healthy] = await Promise.all([
         this.validateSession(sessionId),
         this.checkHealth(sessionId),
      ]);

      if (!valid || !healthy) return;

      const check = (role === RoleEnum.mentee &&
         (await this.checkMenteeUsageLimit.run(userId))) || {
         allowed: true,
         message: undefined,
      };

      if (!check.allowed)
         return this.sendSystem(
            sessionId,
            check.message || '⚠️ Limite de uso excedido.',
         );

      const baseId = randomUUID();

      const lastMessagesDb = await this.prisma.message.findMany({
         where: { sessionId, role: { in: ['user', 'assistant'] } },
         skip: 1,
         take: 20,
         cursor: { id: userMessageId },
         orderBy: { createdAt: 'desc' },
         select: { role: true, content: true, timestamp: true },
      });

      const lastMessages = lastMessagesDb.reverse().map((m) => ({
         content: m.content,
         role: m.role as 'user' | 'assistant',
         timestamp: new Date(m.timestamp).toISOString(),
      }));

      let resp: Responses.Response;
      let tokens = { input: 0, output: 0 };
      const startedAt = new Date();

      try {
         resp = await this.igd.queryAgent(agentId, {
            userId,
            agentId,
            sessionId,
            lastMessages,
            message: { role: 'user', content: originalContent },
         });

         tokens = {
            input: Number(resp.usage?.input_tokens) || 0,
            output: Number(resp.usage?.output_tokens) || 0,
         };
      } catch (e) {
         this.logger.error(
            `[MessagesProcessor] Error querying agent ${agentId}:`,
            e,
         );
         await this.sendSystem(sessionId, '⚠️ Falha ao consultar o agente.');
         return;
      }

      const toJson = (v: unknown): Prisma.InputJsonValue =>
         JSON.parse(JSON.stringify(v ?? null));

      try {
         await this.prisma.$transaction(async (tx) => {
            await tx.message.create({
               data: {
                  sessionId,
                  id: baseId,
                  timestamp: startedAt,
                  content: resp?.output_text ?? '',
                  createdAt: startedAt,
                  role: MessageRoleEnum.assistant,
                  completionTokens: tokens.output,
                  metadataJson: toJson({
                     id: resp?.id ?? null,
                     role: 'assistant',
                     usage: resp?.usage ?? null,
                     session: { agentId, model: resp?.model ?? null },
                     tools: {
                        tools: resp?.tools ?? null,
                        tool_choice: resp?.tool_choice ?? null,
                     },
                     error: resp?.error ?? null,
                     metadata: resp?.metadata ?? null,
                  }),
               },
            });

            const updated = await tx.message.updateMany({
               where: { id: userMessageId },
               data: { promptTokens: tokens.input },
            });

            if (updated.count === 0) {
               throw new Error(`userMessageId not found: ${userMessageId}`);
            }
         });
      } catch (e) {
         this.logger.error('[MessagesProcessor] DB tx failed', e);
         throw new InternalServerErrorException(
            'Failed to persist assistant message',
         );
      }

      try {
         await this.pubSub.publish(`message:${sessionId}`, {
            [S_MESSAGE_ADDED]: {
               id: baseId,
               sessionId,
               createdAt: startedAt.toISOString(),
               timestamp: startedAt.toISOString(),
               content: resp?.output_text ?? '',
               role: MessageRoleEnum.assistant,
               updatedAt: new Date().toISOString(),
            },
         });
      } catch (e) {
         this.logger.error('[MessagesProcessor] PubSub publish failed', e);
      }

      const canQueue =
         role === RoleEnum.mentee &&
         check.allowed &&
         'limitId' in check &&
         'menteeId' in check &&
         !!check.limitId &&
         !!check.menteeId;
      if (canQueue) {
         try {
            await this.menteeLimitsQueue.add(
               PROCESSORS.UPDATE_MENTEE_LIMIT,
               {
                  message: `Atualização de limite para o usuario ${userId}`,
                  userId,
                  menteeId: check.menteeId,
                  limitId: check.limitId,
                  inputTokens: tokens.input,
                  outputTokens: tokens.output,
               },
               { removeOnComplete: false },
            );
         } catch {
            this.logger.error('Failed to add mentee limit to queue');
         }
      }
   }

   private async sendSystem(sessionId: string, content: string) {
      try {
         const msg = await this.prisma.message.create({
            data: {
               content,
               sessionId,
               role: MessageRoleEnum.system,
               metadataJson: { role: 'system' },
               timestamp: new Date().toISOString(),
            },
         });
         this.pubSub.publish(`message:${sessionId}`, {
            [S_MESSAGE_ADDED]: msg,
         });
      } catch {}
   }

   private async validateSession(id: string) {
      try {
         const s = await this.prisma.session.findUnique({
            where: { id },
            include: { Agent: { select: { isActive: true } } },
         });
         if (!s || !s.Agent?.isActive) {
            await this.sendSystem(id, '⚠️ Este agente está desativado.');
            return false;
         }
         return true;
      } catch {
         await this.sendSystem(id, '⚠️ Erro ao validar sessão.');
         return false;
      }
   }

   private async checkHealth(sessionId: string) {
      try {
         const ok = (await this.igd.health()).status === 'ok';
         if (!ok) {
            await this.sendSystem(
               sessionId,
               '⚠️ Serviço indisponível no momento.',
            );
         }
         return ok;
      } catch {
         await this.sendSystem(
            sessionId,
            '⚠️ Serviço indisponível no momento.',
         );
         return false;
      }
   }
}
