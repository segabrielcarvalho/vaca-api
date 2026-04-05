import { Injectable } from '@nestjs/common';
import {
   AclScopeType,
   CorrectionCaptureStatus,
} from '../../../../../.prisma/client';
import { AuthCurrentUser } from '../../../auth/services/auth-context.service';
import { ScopedAccessService } from '../../../auth/services/shared/scoped-access.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CorrectionDashboardDayObject } from '../../objects/correction-dashboard-day.object';
import { CorrectionDashboardObject } from '../../objects/correction-dashboard.object';

const DASHBOARD_DAY_COUNT = 7;
const DASHBOARD_TIMEZONE = 'America/Sao_Paulo';
const FINAL_CAPTURE_STATUSES: CorrectionCaptureStatus[] = [
   CorrectionCaptureStatus.graded,
   CorrectionCaptureStatus.needs_review,
   CorrectionCaptureStatus.error,
];

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
   timeZone: DASHBOARD_TIMEZONE,
   year: 'numeric',
   month: '2-digit',
   day: '2-digit',
});

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', {
   timeZone: DASHBOARD_TIMEZONE,
   weekday: 'short',
});

function buildDayReference(offsetFromToday: number) {
   const date = new Date();
   date.setUTCHours(12, 0, 0, 0);
   date.setUTCDate(date.getUTCDate() - offsetFromToday);
   return date;
}

function formatDateKey(date: Date) {
   return dateKeyFormatter.format(date);
}

function formatWeekdayLabel(date: Date) {
   return weekdayFormatter.format(date).replace('.', '');
}

function buildEmptyDashboardDays(): CorrectionDashboardDayObject[] {
   return Array.from({ length: DASHBOARD_DAY_COUNT }, (_, index) => {
      const offset = DASHBOARD_DAY_COUNT - 1 - index;
      const reference = buildDayReference(offset);

      return {
         dateKey: formatDateKey(reference),
         label: formatWeekdayLabel(reference),
         questionCount: 0,
         captureCount: 0,
         needsReviewCount: 0,
      };
   });
}

@Injectable()
export class GetCorrectionDashboardService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly scopedAccessService: ScopedAccessService,
   ) {}

   async run(user: AuthCurrentUser): Promise<CorrectionDashboardObject> {
      const days = buildEmptyDashboardDays();
      const selectedSchoolId = user.selectedSchoolId;

      if (!selectedSchoolId) {
         return {
            totalQuestionCount: 0,
            totalCaptureCount: 0,
            totalNeedsReviewCount: 0,
            days,
         };
      }

      const firstDayKey = days[0]?.dateKey;
      if (!firstDayKey) {
         return {
            totalQuestionCount: 0,
            totalCaptureCount: 0,
            totalNeedsReviewCount: 0,
            days,
         };
      }

      const rangeStart = new Date();
      rangeStart.setUTCDate(rangeStart.getUTCDate() - DASHBOARD_DAY_COUNT - 1);
      rangeStart.setUTCHours(0, 0, 0, 0);

      const captures = await this.prisma.correctionCapture.findMany({
         where: {
            status: {
               in: FINAL_CAPTURE_STATUSES,
            },
            resolvedAt: {
               gte: rangeStart,
            },
            Exam: {
               Klass: {
                  Course: {
                     schoolId: selectedSchoolId,
                  },
               },
            },
         },
         select: {
            status: true,
            resolvedAt: true,
            Exam: {
               select: {
                  klassId: true,
                  _count: {
                     select: {
                        Questions: true,
                     },
                  },
               },
            },
         },
      });

      const permissionEntries = await Promise.all(
         [
            ...new Set(
               captures.map((capture) => capture.Exam?.klassId).filter(Boolean),
            ),
         ].map(
            async (klassId): Promise<[string, boolean]> => [
               klassId as string,
               await this.scopedAccessService.hasPermission({
                  user,
                  permissionCode: 'klass.correction.read',
                  scopeType: AclScopeType.klass,
                  scopeId: klassId as string,
               }),
            ],
         ),
      );
      const allowedKlassMap = new Map(permissionEntries);
      const daysByKey = new Map(days.map((day) => [day.dateKey, day]));

      for (const capture of captures) {
         if (!capture.resolvedAt) {
            continue;
         }
         if (
            !capture.Exam?.klassId ||
            !allowedKlassMap.get(capture.Exam.klassId)
         ) {
            continue;
         }

         const dayKey = formatDateKey(capture.resolvedAt);
         if (dayKey < firstDayKey) {
            continue;
         }

         const currentDay = daysByKey.get(dayKey);
         if (!currentDay) {
            continue;
         }

         const questionCount = capture.Exam?._count?.Questions ?? 0;
         currentDay.questionCount += questionCount;
         currentDay.captureCount += 1;

         if (capture.status === CorrectionCaptureStatus.needs_review) {
            currentDay.needsReviewCount += 1;
         }
      }

      return {
         totalQuestionCount: days.reduce(
            (sum, day) => sum + day.questionCount,
            0,
         ),
         totalCaptureCount: days.reduce(
            (sum, day) => sum + day.captureCount,
            0,
         ),
         totalNeedsReviewCount: days.reduce(
            (sum, day) => sum + day.needsReviewCount,
            0,
         ),
         days,
      };
   }
}
