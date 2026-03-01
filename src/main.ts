import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import getApp from './modules/app/app';

async function bootstrap() {
   const app = await getApp();
   const configService = app.get(ConfigService);
   const port = configService.get<number>('app.port');

   await app.listen(port);

   const logger = new Logger('Main');
   const url = await app.getUrl();
   const cyan = '\x1b[36m';

   logger.log(`${cyan}API Running at ${url}/`);
   logger.log(`${cyan}GRAPHQL Running at ${url}/graphql`);
}
bootstrap();
