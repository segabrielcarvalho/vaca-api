import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MyLogger } from '../../../../logger/my-logger.service';
import emailConfig from '../../../email.config';
import { EmailModule } from '../../../email.module';
import EtherealImplementation from './ethereal.implementation';

type LoggerLike = Pick<
   MyLogger,
   'setContext' | 'log' | 'error' | 'warn' | 'debug'
>;

describe('EtherealImplementation', () => {
   let config: ReturnType<typeof emailConfig>;

   beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
         imports: [EmailModule],
         providers: [ConfigService],
      }).compile();

      const service = await moduleRef.resolve(ConfigService);
      config = service.get<ReturnType<typeof emailConfig>>('email');
   });

   it(`deve enviar um email`, async () => {
      const mockLogger: LoggerLike = {
         setContext: jest.fn(),
         log: jest.fn(),
         error: jest.fn(),
         warn: jest.fn(),
         debug: jest.fn(),
      };

      const emailProvider = new EtherealImplementation(config, mockLogger);
      await emailProvider.sendEmail({
         to: 'fake@user.com',
         subject: 'Lorem',
         html: 'Lorem Ipsum Dolor Colors',
      });
      expect(true).toBeTruthy();
   });
});
