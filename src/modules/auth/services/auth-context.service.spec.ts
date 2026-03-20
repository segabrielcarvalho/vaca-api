import { AuthChannelEnum, RoleEnum } from '../../../../.prisma/client';
import { AuthContextService } from './auth-context.service';

describe('AuthContextService', () => {
   let service: AuthContextService;

   beforeEach(() => {
      service = new AuthContextService(
         {
            verify: jest.fn(),
         } as never,
         {
            isSessionActive: jest.fn(),
         } as never,
         {
            jwt: {
               accessSecret: 'access-secret',
               contextSecret: 'context-secret',
            },
         } as never,
      );
   });

   it('retorna undefined sem quebrar quando request nao possui headers', () => {
      expect(
         service.extractAccessTokenFromRequest({
            cookies: {},
         } as never),
      ).toBeUndefined();
   });

   it('prioriza bearer token quando header authorization existe', () => {
      expect(
         service.extractAccessTokenFromRequest({
            headers: {
               authorization: 'Bearer abc123',
            },
            cookies: {
               access_token: 'cookie-token',
            },
         } as never),
      ).toBe('abc123');
   });

   it('consegue validar sessao ativa a partir do token decodificado', async () => {
      const decodeSpy = jest
         .spyOn(service, 'decodeAccessToken')
         .mockReturnValue({
            id: 'user-1',
            role: RoleEnum.admin,
            sessionId: 'session-1',
            channel: AuthChannelEnum.web_admin,
         });
      const isSessionActive = jest
         .spyOn(service, 'isSessionActive')
         .mockResolvedValue(true);

      await expect(
         service.resolveAuthenticatedUserFromRequest({
            headers: {
               authorization: 'Bearer abc123',
            },
         } as never),
      ).resolves.toEqual({
         id: 'user-1',
         role: RoleEnum.admin,
         sessionId: 'session-1',
         channel: AuthChannelEnum.web_admin,
      });
      expect(decodeSpy).toHaveBeenCalledWith('abc123');
      expect(isSessionActive).toHaveBeenCalledWith({
         id: 'user-1',
         role: RoleEnum.admin,
         sessionId: 'session-1',
         channel: AuthChannelEnum.web_admin,
      });
   });
});
