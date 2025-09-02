import { Processor, WorkerHost } from '@nestjs/bullmq';
import { MessageRoleEnum } from '@prisma/client';
import { Job } from 'bullmq';
import { MyLogger } from '../../logger/my-logger.service';
import { OpenAiProvider } from '../../open-ai/providers/open-ai.provider';
import { PrismaService } from '../../prisma/prisma.service';
import { CREATE_SESSION_TITLE_PROMPT } from '../constants/create-session-title.prompt';
import PROCESSORS from '../constants/processor.constants';
import QUEUES from '../constants/queue.constants';

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

@Processor(QUEUES.SESSIONS)
export class SessionProcessor extends WorkerHost {
   constructor(
      private readonly logger: MyLogger,
      private readonly openAI: OpenAiProvider,
      private readonly prisma: PrismaService,
   ) {
      super();
      this.logger.setContext(SessionProcessor.name);
   }

   async process(job: Job<{ sessionId: string }>) {
      switch (job.name) {
         case PROCESSORS.CREATE_SESSION_TITLE:
            const { title, sessionId } = await this.handleCreateTitle(
               job.data.sessionId,
            );

            return this.prisma.session.update({
               where: { id: sessionId },
               data: { title },
            });

         default:
            this.logger.warn(`Nenhum handler para o job: ${job.name}`);
            return null;
      }
   }

   private async handleCreateTitle(sessionId: string) {
      const firstBotMsg = await this.prisma.message.findFirst({
         where: { sessionId, role: MessageRoleEnum.assistant },
         orderBy: { createdAt: 'asc' },
      });

      if (!firstBotMsg) return { sessionId, title: 'Nova Sessão' };

      const title = await this.generateTitle(firstBotMsg.content);
      return { sessionId, title };
   }

   private async generateTitle(content: string): Promise<string> {
      const messages = [
         { role: 'system', content: CREATE_SESSION_TITLE_PROMPT },
         { role: 'user', content },
      ] as const satisfies ChatMsg[];
      const raw = await this.openAI.generateText(messages, 0.3, 16);
      return raw.trim();
   }
}
