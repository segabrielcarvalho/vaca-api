import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { STORAGE_PROVIDER } from '../providers';
import type IS3Provider from '../providers/s3/s3.interface';
import storageConfig from '../storage.config';

@Injectable()
export class GetUrlService {
   private readonly logger = new Logger(GetUrlService.name);

   constructor(
      @Inject(storageConfig.KEY)
      private readonly config: ConfigType<typeof storageConfig>,

      @Inject(STORAGE_PROVIDER)
      private readonly storageProvider: IS3Provider,
   ) {}

   public async run(
      path: string,
      expiresIn = 600,
      inline = true,
   ): Promise<string> {
      const key = path;
      const preserveBucketPrefix =
         this.config.environment === 'local';
      const publicHost = this.resolvePublicHost();

      if (publicHost) {
         this.logger.debug(`Signing public URL for "${key}" via ${publicHost}.`);
         return this.storageProvider.getCdnSignedUrl(
            key,
            publicHost,
            expiresIn,
            inline,
            preserveBucketPrefix,
         );
      }

      return this.storageProvider.getSignedUrl(key, expiresIn, inline);
   }

   private resolvePublicHost() {
      const cloudFrontUrl = this.config.storage.cloudFrontUrl?.trim();
      if (!cloudFrontUrl) {
         return null;
      }

      return cloudFrontUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
   }
}
