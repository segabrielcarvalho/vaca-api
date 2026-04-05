import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import logConfig from '../../logger/logger.config';
import { MyLogger } from '../../logger/my-logger.service';
import emailConfig from '../email.config';
import EtherealImplementation from './implementations/ethereal/ethereal.implementation';
import SesImplementation from './implementations/ses/ses.implementation';
import SendGridImplementation from './implementations/sendgrid/sendgrid.implementation';

const providers = {
   ethereal: EtherealImplementation,
   ses: SesImplementation,
   sendgrid: SendGridImplementation,
};

const EmailProvider: Provider = {
   provide: 'EmailProvider',
   inject: [ConfigService],
   useFactory: async (configService: ConfigService) => {
      const config = configService.get<ReturnType<typeof emailConfig>>('email');
      const loggerConfig =
         configService.get<ReturnType<typeof logConfig>>('logger');
      const logger = new MyLogger(loggerConfig);
      const EmailProvider = providers[config.driver];
      return new EmailProvider(config, logger);
   },
};

export default EmailProvider;
