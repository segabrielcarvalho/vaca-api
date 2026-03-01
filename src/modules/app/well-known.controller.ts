import { Controller, Get, Header, Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import authConfig from '../auth/auth.config';
import { Public } from '../auth/decorators/public.decorator';

type AppleAppSiteAssociationResponse = {
   applinks: {
      apps: string[];
      details: Array<{
         appIDs: string[];
         components: Array<Record<string, string>>;
      }>;
   };
};

type AndroidAssetLinksResponse = Array<{
   relation: string[];
   target: {
      namespace: 'android_app';
      package_name: string;
      sha256_cert_fingerprints: string[];
   };
}>;

@Public()
@Controller('.well-known')
export class WellKnownController {
   constructor(
      @Inject(authConfig.KEY)
      private readonly auth: ConfigType<typeof authConfig>,
   ) {}

   @Get('apple-app-site-association')
   @Header('Content-Type', 'application/json')
   appleAppSiteAssociation(): AppleAppSiteAssociationResponse {
      const appId = this.resolveAppleAppId();
      const appIds = appId ? [appId] : [];
      const details =
         appIds.length > 0
            ? [
                 {
                    appIDs: appIds,
                    components: this.auth.association.applinks.paths.map(
                       (path) => ({
                          '/': path,
                       }),
                    ),
                 },
              ]
            : [];

      return {
         applinks: { apps: [], details },
      };
   }

   @Get('assetlinks.json')
   @Header('Content-Type', 'application/json')
   assetLinks(): AndroidAssetLinksResponse {
      const packageName = this.auth.association.android.packageName;
      const fingerprints = this.auth.association.android.sha256CertFingerprints;
      if (!packageName || fingerprints.length === 0) {
         return [];
      }

      return [
         {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
               namespace: 'android_app',
               package_name: packageName,
               sha256_cert_fingerprints: fingerprints,
            },
         },
      ];
   }

   private resolveAppleAppId() {
      const teamId = this.auth.association.ios.teamId;
      const bundleId = this.auth.association.ios.bundleId;
      if (!teamId || !bundleId) return '';
      return `${teamId}.${bundleId}`;
   }
}
