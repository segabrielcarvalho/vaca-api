import { Processor, WorkerHost } from '@nestjs/bullmq';
import { PeriodUnitEnum } from '@prisma/client';
import { Job } from 'bullmq';
import { MyLogger } from '../../logger/my-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import PROCESSORS from '../constants/processor.constants';
import QUEUES from '../constants/queue.constants';

export type UpdatePayload = {
   userId?: string | null;
   menteeId?: string | null;
   limitId?: string | null;
   inputTokens?: number;
   outputTokens?: number;
};

@Processor(QUEUES.MENTEE_LIMITS, { concurrency: 5 })
export class UpdateMenteeLimitProcessor extends WorkerHost {
   constructor(
      private readonly logger: MyLogger,
      private readonly prisma: PrismaService,
   ) {
      super();
      this.logger.setContext(UpdateMenteeLimitProcessor.name);
   }

   async process(job: Job<any, any, string>): Promise<any> {
      switch (job.name) {
         case PROCESSORS.UPDATE_MENTEE_LIMIT:
            return this.updateLimit(job.data as UpdatePayload);
         default:
            return null;
      }
   }

   private async updateLimit(payload: UpdatePayload) {
      const menteeId =
         payload.menteeId ?? (await this.findMenteeId(payload.userId));
      const limitId = payload.limitId ?? null;
      if (!menteeId || !limitId) return null;

      const limit = await this.prisma.planLimit.findUnique({
         where: { id: limitId },
         select: { id: true, isActive: true, period: true },
      });
      if (!limit || !limit.isActive) return null;

      const now = new Date();
      const key = { menteeId_limitId: { menteeId, limitId } };

      return this.prisma.$transaction(async (tx) => {
         const usage =
            (await tx.menteeUsageLimit.findUnique({
               where: key,
               select: { lastReset: true, isActive: true },
            })) ??
            (await tx.menteeUsageLimit.create({
               data: {
                  menteeId,
                  limitId,
                  used: 0,
                  tokens: 0,
                  lastReset: now,
                  isActive: true,
               },
               select: { lastReset: true, isActive: true },
            }));

         if (!usage.isActive) return null;

         const expired =
            now.getTime() - usage.lastReset.getTime() >=
            this.toMs(limit.period);
         if (expired) {
            await tx.menteeUsageLimit.update({
               where: key,
               data: { used: 0, tokens: 0, lastReset: now },
            });
         }

         const sum = Math.max(
            0,
            (payload.inputTokens ?? 0) + (payload.outputTokens ?? 0),
         );

         const updated = await tx.menteeUsageLimit.update({
            where: key,
            data: {
               used: { increment: 1 },
               ...(sum > 0 && { tokens: { increment: sum } }),
            },
         });

         this.logger.log(
            `Atualização de tokens -- menteeId: ${menteeId} -- limitId: ${limitId} -- Incremento: +1 used ${sum > 0 ? `, +${sum} tokens` : ''} -- Totais: used= ${updated.used - 1} -> ${updated.used}, tokens=${updated.tokens - sum} -> ${updated.tokens} -- Data/Hora: ${now.toISOString()}`,
         );

         return true;
      });
   }

   private async findMenteeId(userId?: string | null) {
      if (!userId) return null;
      const mentee = await this.prisma.mentee.findUnique({
         where: { userId },
         select: { id: true },
      });
      return mentee?.id ?? null;
   }

   private toMs(unit: PeriodUnitEnum): number {
      const H = 36e5;
      const map: Record<PeriodUnitEnum, number> = {
         hour: 1,
         day: 24,
         week: 168,
         month: 720,
         year: 8760,
      };
      return H * map[unit];
   }
}
