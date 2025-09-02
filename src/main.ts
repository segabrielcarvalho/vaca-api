import './modules/graphql/enums';

import { ConfigService } from '@nestjs/config';
import getApp from './modules/app/app';
import { MyLogger } from './modules/logger/my-logger.service';

async function bootstrap() {
   const app = await getApp();
   const configService = app.get(ConfigService);
   const port = configService.get<number>('app.port');

   await app.listen(port);

   const logger = await app.resolve(MyLogger);

   const highlightedString = `\x1b[35m${await app.getUrl()}/graphql\x1b[0m`;

   const templateString = `🚀 Running in ${highlightedString}`;

   logger.setContext('Main');

   logger.log(templateString);
}
bootstrap();
