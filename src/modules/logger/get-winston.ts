import type { ConfigType } from '@nestjs/config';
import { type Logger, createLogger, format, transports } from 'winston';
import Logsene from 'winston-logsene';
import type logConfig from './logger.config';

const LOG_DIR = 'logs';
const { combine, timestamp, printf, metadata } = format;
const messageFormat = printf(
   ({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`,
);

const createFileTransport = (level: string) =>
   new transports.File({
      level,
      filename: `${level}.log`,
      dirname: LOG_DIR,
      maxFiles: 1,
      maxsize: 4 * 1024 * 1024,
      format: combine(timestamp(), messageFormat),
   });

const getWinston = (config: ConfigType<typeof logConfig>): Logger => {
   const logger = createLogger({
      level: 'info',
      format: combine(timestamp(), messageFormat),
   });

   if (config.file.enable) {
      for (const level of ['error', 'warn', 'info']) {
         logger.add(createFileTransport(level));
      }
   }

   if (config.logSene.enable) {
      logger.add(
         new Logsene({
            token: config.logSene.token,
            format: combine(timestamp(), metadata()),
         }),
      );
   }

   return logger;
};

export default getWinston;
