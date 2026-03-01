import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthCleanupService implements OnModuleInit, OnModuleDestroy {
   private interval?: NodeJS.Timeout;

   constructor(private readonly prisma: PrismaService) {}

   onModuleInit() {
      this.interval = setInterval(
         () => {
            void this.cleanExpiredRecords();
         },
         5 * 60 * 1000,
      );

      this.interval.unref?.();
   }

   onModuleDestroy() {
      if (this.interval) clearInterval(this.interval);
   }

   private async cleanExpiredRecords() {
      const now = new Date();

      await this.prisma.authSession.updateMany({
         where: { expiresAt: { lt: now }, revokedAt: null },
         data: { revokedAt: now },
      });
   }
}
