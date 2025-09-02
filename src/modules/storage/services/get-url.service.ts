import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { STORAGE_PROVIDER } from '../providers';
import type IS3Provider from '../providers/s3/s3.interface';
import storageConfig from '../storage.config';

@Injectable()
export class GetUrlService {
   constructor(
      @Inject(storageConfig.KEY)
      private readonly config: ConfigType<typeof storageConfig>,

      @Inject(STORAGE_PROVIDER)
      private readonly storageProvider: IS3Provider,
   ) {}

   public async run(path: string, expiresIn = 600): Promise<string> {
      const { environment, storage } = this.config;

      const key = path;

      if (environment === 'cloud') {
         const domain = storage.cloudFrontUrl
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '');
         return this.storageProvider.getCdnSignedUrl(
            key,
            domain,
            expiresIn,
            true,
         );
      }

      return this.storageProvider.getSignedUrl(key, expiresIn, true);
   }
}
