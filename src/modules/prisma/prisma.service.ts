import {
   Inject,
   Injectable,
   OnModuleDestroy,
   OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
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
      super(config);
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
