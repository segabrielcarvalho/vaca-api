import { Controller, Get, Inject } from '@nestjs/common';
import {
   HealthCheck,
   HealthCheckError,
   HealthCheckService,
   HealthIndicatorResult,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_QUEUE_CLIENT } from '../redis/redis.constants';

@Public()
@Controller('health')
export class HealthController {
   constructor(
      private readonly health: HealthCheckService,
      private readonly prisma: PrismaService,
      @Inject(REDIS_QUEUE_CLIENT) private readonly redis: Redis,
   ) {}

   @Get()
   healthCheck(): { status: string; timestamp: string } {
      return {
         status: 'ok',
         timestamp: new Date().toISOString(),
      };
   }

   @Get('ready')
   @HealthCheck()
   readiness() {
      return this.health.check([
         () => this.checkDatabase(),
         () => this.checkRedis(),
      ]);
   }

   private async checkDatabase(): Promise<HealthIndicatorResult> {
      try {
         await this.prisma.$queryRaw`SELECT 1`;
         return { database: { status: 'up' } };
      } catch {
         throw new HealthCheckError('Falha na verificação do banco de dados', {
            database: { status: 'down' },
         });
      }
   }

   private async checkRedis(): Promise<HealthIndicatorResult> {
      try {
         const pong = await this.redis.ping();
         if (pong !== 'PONG') {
            throw new Error('Resposta inválida do Redis');
         }
         return { redis: { status: 'up' } };
      } catch {
         throw new HealthCheckError('Falha na verificação do Redis', {
            redis: { status: 'down' },
         });
      }
   }
}
