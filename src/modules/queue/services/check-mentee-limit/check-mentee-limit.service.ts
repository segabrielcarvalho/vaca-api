import { Injectable } from '@nestjs/common';
import { LimitTypeEnum, PeriodUnitEnum } from '@prisma/client';
import { pickLimitMessage } from '../../../chat/message/constants/limit-messages';
import { PrismaService } from '../../../prisma/prisma.service';
type CheckResult =
   | { allowed: false; message?: string }
   | { allowed: true; menteeId: string; limitId: string; message?: string };

@Injectable()
export class CheckMenteeUsageLimit {
   constructor(private readonly prisma: PrismaService) {}

   async run(userId: string): Promise<CheckResult> {
      if (!userId) return { allowed: false };

      const mentee = await this.prisma.mentee.findUnique({
         where: { userId },
         select: { id: true },
      });
      if (!mentee) {
         return { allowed: false };
      }

      const eligibleLimits = await this.prisma.planLimit.findMany({
         where: {
            isActive: true,
            Plan: { isActive: true, Mentee: { some: { id: mentee.id } } },
         },
         select: { id: true, limitValue: true, period: true, limitType: true },
      });

      const usage = await this.prisma.menteeUsageLimit.findMany({
         where: {
            menteeId: mentee.id,
            isActive: true,
            limitId: { in: eligibleLimits.map((l) => l.id) },
         },
         select: { limitId: true, used: true, tokens: true, lastReset: true },
      });

      if (eligibleLimits.length === 0)
         return {
            allowed: false,
            message: 'Você não possui plano com limites ativos.',
         };

      const H = 36e5;
      const periodMs: Record<PeriodUnitEnum, number> = {
         hour: H,
         day: 24 * H,
         week: 7 * 24 * H,
         month: 30 * 24 * H,
         year: 365 * 24 * H,
      };
      const now = Date.now();

      const usageByLimit = new Map(usage.map((u) => [u.limitId, u]));
      type Candidate = { limitId: string; remaining: number; nextReset: Date };
      const candidates: Candidate[] = [];
      let earliestReset: Date | null = null;

      for (const lim of eligibleLimits) {
         const u = usageByLimit.get(lim.id);
         const pMs = periodMs[lim.period] ?? periodMs.month;
         const last = u?.lastReset ?? new Date(now);
         const expiresAt = new Date(last.getTime() + pMs);
         const expired = now >= expiresAt.getTime();
         const current =
            lim.limitType === LimitTypeEnum.request
               ? expired
                  ? 0
                  : (u?.used ?? 0)
               : expired
                 ? 0
                 : (u?.tokens ?? 0);
         const remaining = Math.max(0, lim.limitValue - current);
         const nextReset = expired ? new Date(now + pMs) : expiresAt;

         if (!earliestReset || nextReset < earliestReset)
            earliestReset = nextReset;
         if (remaining > 0)
            candidates.push({ limitId: lim.id, remaining, nextReset });
      }

      if (candidates.length) {
         candidates.sort(
            (a, b) =>
               a.nextReset.getTime() - b.nextReset.getTime() ||
               b.remaining - a.remaining,
         );
         const chosen = candidates[0];

         return { allowed: true, menteeId: mentee.id, limitId: chosen.limitId };
      }

      return { allowed: false, message: pickLimitMessage() };
   }
}
