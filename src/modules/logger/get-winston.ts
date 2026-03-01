import type { ConfigType } from '@nestjs/config';
import fs from 'node:fs';
import { inspect } from 'node:util';
import { type Logger, createLogger, format, transports } from 'winston';
import Logsene from 'winston-logsene';
import type logConfig from './logger.config';
import type { JsonRecord, JsonValue } from 'src/types/json';

const LOG_DIR = 'logs';
const { combine, timestamp, printf, metadata, splat, errors } = format;

const baseFormat = combine(
   timestamp(),
   errors({ stack: true }),
   splat(),
   metadata({ fillExcept: ['message', 'level', 'timestamp', 'stack'] }),
);

const filterByLevel = (level: string) =>
   format((info) => (info.level === level ? info : false))();

type LogMessage = JsonValue | Error;

const formatMetadata = (meta: JsonRecord | undefined) => {
   if (!meta || Object.keys(meta).length === 0) return '';
   return ` ${inspect(meta, { depth: 5, breakLength: 120 })}`;
};

const renderMessage = (message: LogMessage) =>
   typeof message === 'string'
      ? message
      : inspect(message, { depth: 5, breakLength: 120 });

const messageFormat = printf((info) => {
   const baseMessage = info.stack ?? info.message;
   const meta = formatMetadata((info as { metadata?: JsonRecord }).metadata);
   return `${info.timestamp} ${info.level}: ${renderMessage(
      baseMessage as LogMessage,
   )}${meta}`;
});

const createFileTransport = (level: string) =>
   new transports.File({
      level,
      filename: `${level}.log`,
      dirname: LOG_DIR,
      maxFiles: 1,
      maxsize: 4 * 1024 * 1024,
      format: combine(filterByLevel(level), baseFormat, messageFormat),
   });

const getWinston = (config: ConfigType<typeof logConfig>): Logger => {
   const logger = createLogger({
      level: 'info',
      format: baseFormat,
   });

   if (config.file.enable) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      for (const level of ['error', 'warn', 'info']) {
         logger.add(createFileTransport(level));
      }
   }

   if (config.logSene.enable) {
      logger.add(
         new Logsene({
            token: config.logSene.token,
            format: baseFormat,
         }),
      );
   }

   return logger;
};

export default getWinston;
