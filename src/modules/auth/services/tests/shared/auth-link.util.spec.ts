import {
   buildAuthFrontendLink,
   extractRequestOrigin,
} from '../../../utils/auth-link.util';

describe('auth-link.util', () => {
   it('deve preferir origem publica da request quando config ainda aponta para localhost', () => {
      const link = buildAuthFrontendLink({
         baseAdminUrl: 'http://localhost:5002',
         baseWebUrl: 'http://localhost:5002',
         requestOrigin: 'https://admin.vaca.app',
         path: '/auth/invite',
         query: { token: 'raw token' },
      });

      expect(link).toBe('https://admin.vaca.app/auth/invite?token=raw+token');
   });

   it('deve manter BASE_WEB_URL publico acima da origem da request', () => {
      const link = buildAuthFrontendLink({
         baseAdminUrl: 'http://localhost:5002',
         baseWebUrl: 'https://web.vaca.app',
         requestOrigin: 'https://admin.vaca.app',
         path: '/auth/invite/verify',
         query: { token: 'magic-token' },
      });

      expect(link).toBe(
         'https://web.vaca.app/auth/invite/verify?token=magic-token',
      );
   });

   it('deve preferir BASE_WEB_URL quando admin e web estao configuradas', () => {
      const link = buildAuthFrontendLink({
         baseAdminUrl: 'https://admin.vaca.app',
         baseWebUrl: 'https://web.vaca.app',
         path: '/auth/invite',
         query: { token: 'invite-token' },
      });

      expect(link).toBe(
         'https://web.vaca.app/auth/invite?token=invite-token',
      );
   });

   it('deve extrair origin primeiro e usar referer como fallback', () => {
      expect(
         extractRequestOrigin({
            origin: 'https://admin.vaca.app',
            referer: 'https://fallback.vaca.app/auth/invite',
         }),
      ).toBe('https://admin.vaca.app');

      expect(
         extractRequestOrigin({
            referer: 'https://fallback.vaca.app/auth/invite?token=1',
         }),
      ).toBe('https://fallback.vaca.app');
   });
});
