import { ConsoleLogger, Inject, Injectable, Scope } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Logger } from 'winston';
import getWinston from './get-winston';
import logConfig from './logger.config';

@Injectable({ scope: Scope.TRANSIENT })
export class MyLogger extends ConsoleLogger {
   private readonly winston: Logger;
   constructor(
      @Inject(logConfig.KEY)
      config: ConfigType<typeof logConfig>,
   ) {
      super();
      if (config?.file?.enable || config?.logSene?.enable)
         this.winston = getWinston(config);
   }

   log(message: any, ...optionalParams: [...any, string?]) {
      super.log(message, ...optionalParams);
      if (this.winston) {
         this.winston.info(message, ...optionalParams);
      }
   }

   error(message: any, ...optionalParams: [...any, string?]) {
      super.error(message, ...optionalParams);
      if (this.winston) {
         this.winston.error(message, ...optionalParams);
      }
   }

   warn(message: any, ...optionalParams: [...any, string?]) {
      super.warn(message, ...optionalParams);
      if (this.winston) {
         this.winston.warn(message, ...optionalParams);
      }
   }

   debug(message: any, ...optionalParams: [...any, string?]) {
      super.debug(message, ...optionalParams);
      if (this.winston) {
         this.winston.debug(message, ...optionalParams);
      }
   }

   verbose(message: any, ...optionalParams: [...any, string?]) {
      super.verbose(message, ...optionalParams);
      if (this.winston) {
         this.winston.verbose(message, ...optionalParams);
      }
   }
}
