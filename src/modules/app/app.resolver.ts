import { Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Query, Resolver } from '@nestjs/graphql';
import appConfig from './app.config';
import { AppLegalLinksObject } from './objects/app-legal-links.object';
import { Public } from '../auth/decorators/public.decorator';

@Resolver()
export class AppResolver {
   constructor(
      @Inject(appConfig.KEY)
      private readonly app: ConfigType<typeof appConfig>,
   ) {}

   @Public()
   @Query(() => String)
   async healthCheck(): Promise<string> {
      return 'App is running';
   }

   @Public()
   @Query(() => AppLegalLinksObject)
   async appLegalLinks(): Promise<AppLegalLinksObject> {
      return {
         termsUrl: this.app.legalTermsUrl || undefined,
         privacyUrl: this.app.legalPrivacyUrl || undefined,
      };
   }
}
