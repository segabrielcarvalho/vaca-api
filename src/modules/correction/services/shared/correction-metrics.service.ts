import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CorrectionMetricsService {
   constructor(private readonly prisma: PrismaService) {}

   async refreshSessionMetrics(sessionId: string) {
      const [session, captures] = await Promise.all([
         this.prisma.correctionSession.findUnique({
            where: { id: sessionId },
            select: {
               startedAt: true,
               finishedAt: true,
            },
         }),
         this.prisma.correctionCapture.findMany({
            where: { sessionId },
            select: {
               status: true,
               processingMs: true,
               reviewReasons: true,
            },
         }),
      ]);

      const totalCaptures = captures.length;
      const gradedCaptures = captures.filter((item) => item.status === 'graded').length;
      const needsReviewCaptures = captures.filter(
         (item) => item.status === 'needs_review',
      ).length;
      const errorCaptures = captures.filter((item) => item.status === 'error').length;
      const processedCaptures = captures.filter(
         (item) => item.status !== 'queued' && item.status !== 'processing',
      ).length;
      const qrInvalidCaptures = captures.filter((item) =>
         item.reviewReasons.some((reason) =>
            [
               'qr_missing',
               'qr_invalid',
               'qr_signature_invalid',
            ].includes(reason),
         ),
      ).length;

      const durations = captures
         .map((item) => item.processingMs)
         .filter((value): value is number => typeof value === 'number' && value >= 0)
         .sort((a, b) => a - b);

      const avgProcessingMs =
         durations.length > 0
            ? durations.reduce((acc, value) => acc + value, 0) / durations.length
            : null;

      const p95ProcessingMs =
         durations.length > 0
            ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
            : null;
      const manualReviewRate =
         processedCaptures > 0 ? needsReviewCaptures / processedCaptures : null;
      const qrInvalidRate =
         processedCaptures > 0 ? qrInvalidCaptures / processedCaptures : null;
      const durationMinutes =
         session && session.startedAt
            ? Math.max(
                 (Number((session.finishedAt ?? new Date()).getTime()) -
                    Number(session.startedAt.getTime())) /
                    60000,
                 0.01,
              )
            : null;
      const throughputPerMinute =
         durationMinutes && processedCaptures > 0
            ? processedCaptures / durationMinutes
            : null;

      return this.prisma.correctionSession.update({
         where: { id: sessionId },
         data: {
            totalCaptures,
            processedCaptures,
            gradedCaptures,
            needsReviewCaptures,
            errorCaptures,
            qrInvalidCaptures,
            avgProcessingMs,
            p95ProcessingMs,
            manualReviewRate,
            qrInvalidRate,
            throughputPerMinute,
         },
      });
   }
}
