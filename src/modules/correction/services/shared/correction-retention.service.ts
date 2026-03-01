import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import correctionConfig from '../../config/correction.config';
import { PrismaService } from '../../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../../../storage/providers';
import type IS3Provider from '../../../storage/providers/s3/s3.interface';

@Injectable()
export class CorrectionRetentionService
   implements OnModuleInit, OnModuleDestroy
{
   private timer: NodeJS.Timeout | null = null;

   constructor(
      private readonly prisma: PrismaService,
      @Inject(STORAGE_PROVIDER)
      private readonly storage: IS3Provider,
      @Inject(correctionConfig.KEY)
      private readonly config: ConfigType<typeof correctionConfig>,
   ) {}

   onModuleInit() {
      const intervalMs = this.config.retentionIntervalHours * 60 * 60 * 1000;

      this.timer = setInterval(() => {
         void this.purgeOldArtifacts();
      }, intervalMs);

      void this.purgeOldArtifacts();
   }

   onModuleDestroy() {
      if (this.timer) {
         clearInterval(this.timer);
         this.timer = null;
      }
   }

   async purgeOldArtifacts() {
      const thresholdDate = new Date(
         Date.now() - this.config.auditRetentionDays * 24 * 60 * 60 * 1000,
      );

      const targets = await this.prisma.correctionCapture.findMany({
         where: {
            createdAt: {
               lt: thresholdDate,
            },
            artifactsPurgedAt: null,
         },
         select: {
            id: true,
            originalImagePath: true,
            rectifiedImagePath: true,
            overlayImagePath: true,
         },
         take: 500,
      });

      for (const target of targets) {
         const keys = [
            target.originalImagePath,
            target.rectifiedImagePath,
            target.overlayImagePath,
         ].filter((value): value is string => Boolean(value));

         await Promise.all(
            keys.map(async (key) => {
               try {
                  await this.storage.deleteFile(key);
               } catch {
                  // ignore cleanup failures to avoid breaking purge flow
               }
            }),
         );

         await this.prisma.correctionCapture.update({
            where: { id: target.id },
            data: {
               originalImagePath: `purged:${target.id}`,
               rectifiedImagePath: null,
               overlayImagePath: null,
               artifactsPurgedAt: new Date(),
            },
         });
      }
   }
}
