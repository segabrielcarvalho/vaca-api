import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageProvider } from './providers';
import { GetUrlService } from './services/get-url.service';
import storageConfig, { validateStorageEnv } from './storage.config';

@Module({
   imports: [
      ConfigModule.forRoot({
         cache: true,
         load: [storageConfig],
         validate: validateStorageEnv,
      }),
   ],
   providers: [GetUrlService, StorageProvider],
   exports: [GetUrlService, StorageProvider],
})
export class StorageModule {}
