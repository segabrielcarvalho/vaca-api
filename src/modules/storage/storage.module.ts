import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageProvider } from './providers';
import { GetUrlService } from './services/get-url.service';

@Module({
   imports: [ConfigModule],
   providers: [GetUrlService, StorageProvider],
   exports: [GetUrlService, StorageProvider],
})
export class StorageModule {}
