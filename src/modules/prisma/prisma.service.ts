import {
   Inject,
   Injectable,
   OnModuleDestroy,
   OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../.prisma/client';
import prismaConfig from './prisma.config';

@Injectable()
export class PrismaService
   extends PrismaClient
   implements OnModuleInit, OnModuleDestroy
{
   constructor(
      @Inject(prismaConfig.KEY)
      config: ConfigType<typeof prismaConfig>,
   ) {
      const { databaseUrl, ...prismaOptions } = config;
      const adapter = new PrismaPg({ connectionString: databaseUrl });

      super({
         ...prismaOptions,
         adapter,
      });
   }

   onModuleDestroy() {
      this.$disconnect();
   }

   async onModuleInit() {
      await this.$connect();
   }

   async enableShutdownHooks() {
      process.on('beforeExit', async () => {
         await this.$disconnect();
      });
   }
}
