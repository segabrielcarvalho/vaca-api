import {
   AuthAuditEventTypeEnum,
   AuthChannelEnum as PrismaAuthChannelEnum,
   Prisma,
} from '../../../../../.prisma/client';
import { Injectable } from '@nestjs/common';
import { MyLogger } from '../../../logger/my-logger.service';

@Injectable()
export class AuthAuditService {
   constructor(private readonly logger: MyLogger) {}

   async run(input: {
      userId?: string;
      eventType: AuthAuditEventTypeEnum;
      channel?: PrismaAuthChannelEnum | null;
      ip?: string;
      userAgent?: string;
      metadata?: Prisma.InputJsonValue;
   }) {
      await this.logger.auditAuthEvent(input);
   }
}
