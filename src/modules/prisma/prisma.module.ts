import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import prismaConfig, { validatePrismaEnv } from './prisma.config';
import { PrismaService } from './prisma.service';

@Module({
   imports: [
      ConfigModule.forRoot({
         cache: true,
         load: [prismaConfig],
         validate: validatePrismaEnv,
      }),
   ],
   providers: [PrismaService],
   exports: [PrismaService],
})
export class PrismaModule {}
