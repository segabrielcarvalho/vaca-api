import { WellKnownController } from './well-known.controller';

const baseConfig = {
   association: {
      ios: {
         teamId: 'TEAM123',
         bundleId: 'com.vaca.mobile.dev',
      },
      android: {
         packageName: 'com.vaca.mobile.dev',
         sha256CertFingerprints: ['AA:BB:CC'],
      },
      applinks: {
         paths: ['/auth/login/magic*'],
      },
   },
};

describe('WellKnownController', () => {
   it('deve retornar AASA com appId e paths configurados', () => {
      const controller = new WellKnownController(baseConfig as any);
      const result = controller.appleAppSiteAssociation();

      expect(result.applinks.details).toEqual([
         {
            appIDs: ['TEAM123.com.vaca.mobile.dev'],
            components: [{ '/': '/auth/login/magic*' }],
         },
      ]);
   });

   it('deve retornar AASA vazio quando ios team/bundle nao estiver configurado', () => {
      const controller = new WellKnownController({
         association: {
            ...baseConfig.association,
            ios: { teamId: '', bundleId: '' },
         },
      } as any);

      const result = controller.appleAppSiteAssociation();

      expect(result.applinks.details).toEqual([]);
   });

   it('deve retornar assetlinks com package e fingerprint', () => {
      const controller = new WellKnownController(baseConfig as any);

      const result = controller.assetLinks();

      expect(result).toEqual([
         {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
               namespace: 'android_app',
               package_name: 'com.vaca.mobile.dev',
               sha256_cert_fingerprints: ['AA:BB:CC'],
            },
         },
      ]);
   });

   it('deve retornar assetlinks vazio quando faltar package/fingerprint', () => {
      const controller = new WellKnownController({
         association: {
            ...baseConfig.association,
            android: {
               packageName: '',
               sha256CertFingerprints: [],
            },
         },
      } as any);

      expect(controller.assetLinks()).toEqual([]);
   });
});
