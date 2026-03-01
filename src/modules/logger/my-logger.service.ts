import { ConsoleLogger, Inject, Injectable, Optional } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { JsonValue } from 'src/types/json';
import type { Logger } from 'winston';
import {
   AuthAuditEventTypeEnum,
   Prisma,
   AuthChannelEnum as PrismaAuthChannelEnum,
} from '../../../.prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import getWinston from './get-winston';
import logConfig from './logger.config';

type LogParam = JsonValue | Error | undefined;

const DEFAULT_HIDDEN_CONTEXTS = [
   'InstanceLoader',
   'RoutesResolver',
   'RouterExplorer',
   'NestFactory',
];

const parseHiddenContexts = (value: string | undefined) => {
   const items = value
      ? value
           .split(',')
           .map((item) => item.trim())
           .filter(Boolean)
      : [];
   const contexts = items.length > 0 ? items : DEFAULT_HIDDEN_CONTEXTS;
   return new Set(contexts);
};

const isStackTrace = (value: string) => /^(.)+\n\s+at .+:\d+:\d+/.test(value);

@Injectable()
export class MyLogger extends ConsoleLogger {
   private readonly winston: Logger;
   private readonly hiddenContexts: Set<string>;
   constructor(
      @Inject(logConfig.KEY)
      config: ConfigType<typeof logConfig>,
      @Optional() private readonly prismaService?: PrismaService,
   ) {
      super();
      this.hiddenContexts = parseHiddenContexts(process.env.LOG_HIDE_CONTEXTS);
      if (config?.file?.enable || config?.logSene?.enable)
         this.winston = getWinston(config);
   }

   private shouldSkipByContext(optionalParams: LogParam[]) {
      if (optionalParams.length === 0) {
         return this.context && this.hiddenContexts.has(this.context);
      }
      const lastParam = optionalParams[optionalParams.length - 1];
      if (typeof lastParam === 'string' && !isStackTrace(lastParam)) {
         return this.hiddenContexts.has(lastParam);
      }
      return this.context && this.hiddenContexts.has(this.context);
   }

   log(message: LogParam, ...optionalParams: LogParam[]) {
      if (this.shouldSkipByContext(optionalParams)) return;
      super.log(message, ...optionalParams);
      if (this.winston) {
         this.winston.info(String(message), { meta: optionalParams });
      }
   }

   error(message: LogParam, ...optionalParams: LogParam[]) {
      if (this.shouldSkipByContext(optionalParams)) return;
      super.error(message, ...optionalParams);
      if (this.winston) {
         this.winston.error(String(message), { meta: optionalParams });
      }
   }

   warn(message: LogParam, ...optionalParams: LogParam[]) {
      if (this.shouldSkipByContext(optionalParams)) return;
      super.warn(message, ...optionalParams);
      if (this.winston) {
         this.winston.warn(String(message), { meta: optionalParams });
      }
   }

   debug(message: LogParam, ...optionalParams: LogParam[]) {
      if (this.shouldSkipByContext(optionalParams)) return;
      super.debug(message, ...optionalParams);
      if (this.winston) {
         this.winston.debug(String(message), { meta: optionalParams });
      }
   }

   verbose(message: LogParam, ...optionalParams: LogParam[]) {
      if (this.shouldSkipByContext(optionalParams)) return;
      super.verbose(message, ...optionalParams);
      if (this.winston) {
         this.winston.verbose(String(message), { meta: optionalParams });
      }
   }

   async auditAuthEvent(input: {
      userId?: string;
      eventType: AuthAuditEventTypeEnum;
      channel?: PrismaAuthChannelEnum | null;
      ip?: string;
      userAgent?: string;
      metadata?: Prisma.InputJsonValue;
   }) {
      if (!this.prismaService) {
         this.warn(
            'PrismaService indisponivel no MyLogger para persistir auditoria',
         );
         return;
      }

      try {
         await this.prismaService.authAuditEvent.create({
            data: {
               userId: input.userId,
               eventType: input.eventType,
               channel: input.channel ?? undefined,
               ip: input.ip,
               userAgent: input.userAgent,
               metadata: input.metadata,
            },
         });
      } catch (error) {
         this.error(
            'Falha ao persistir evento de auditoria no logger',
            error as Error,
         );
      }
   }
}
