import { UnauthorizedException } from '@nestjs/common';
import { AuthChannelEnum } from '../../../../../../.prisma/client';
import { AUTH_COOKIE } from '../../../auth.constants';
import { ValidateCsrfTokenService } from '../../shared/validate-csrf-token.service';

describe('ValidateCsrfTokenService', () => {
   let service: ValidateCsrfTokenService;

   beforeEach(() => {
      service = new ValidateCsrfTokenService();
   });

   it('deve ignorar csrf fora do canal web_admin', () => {
      expect(() =>
         service.run({
            req: {} as any,
            channel: AuthChannelEnum.expo_mobile,
            usingCookieAuth: true,
         }),
      ).not.toThrow();
   });

   it('deve ignorar csrf quando nao usa cookie auth', () => {
      expect(() =>
         service.run({
            req: {} as any,
            channel: AuthChannelEnum.web_admin,
            usingCookieAuth: false,
         }),
      ).not.toThrow();
   });

   it('deve falhar sem cookie/header csrf no web cookie auth', () => {
      expect(() =>
         service.run({
            req: { cookies: {}, headers: {} } as any,
            channel: AuthChannelEnum.web_admin,
            usingCookieAuth: true,
         }),
      ).toThrow(UnauthorizedException);
   });

   it('deve falhar com csrf divergente', () => {
      expect(() =>
         service.run({
            req: {
               cookies: { [AUTH_COOKIE.CSRF]: 'abc' },
               headers: { 'x-csrf-token': 'xyz' },
            } as any,
            channel: AuthChannelEnum.web_admin,
            usingCookieAuth: true,
         }),
      ).toThrow(UnauthorizedException);
   });

   it('deve aceitar com csrf valido no header e cookie', () => {
      expect(() =>
         service.run({
            req: {
               cookies: { [AUTH_COOKIE.CSRF]: 'token-seguro' },
               headers: { 'x-csrf-token': 'token-seguro' },
            } as any,
            channel: AuthChannelEnum.web_admin,
            usingCookieAuth: true,
         }),
      ).not.toThrow();
   });
});
