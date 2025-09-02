import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageConfig as NestStorageConfig } from '../storage.config';
import S3Provider from './s3/s3.provider';

export const STORAGE_PROVIDER = 'StorageProvider';

export const StorageProvider: Provider = {
   provide: STORAGE_PROVIDER,
   inject: [ConfigService],
   useFactory: async (configService: ConfigService) => {
      const nestConfig = configService.get<NestStorageConfig>('storage');
      if (!nestConfig) {
         throw new Error('Storage configuration is undefined');
      }

      const { bucket, region, credentials, endpoint } = nestConfig.storage;

      if (!region) {
         throw new Error(
            'STORAGE_REGION não definida em storage.environment.cloud',
         );
      }

      return new S3Provider({
         bucket,
         region,
         credentials,
         endpoint,
      });
   },
};
