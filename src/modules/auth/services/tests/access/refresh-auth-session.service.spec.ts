import { RoleEnum } from '../../../../../../.prisma/client';
import { RefreshAuthSessionService } from '../../access/refresh-auth-session.service';

describe('RefreshAuthSessionService', () => {
   let prisma: {
      authSession: { findFirst: jest.Mock; update: jest.Mock };
      user: { findUnique: jest.Mock };
   };
   let sessionService: { run: jest.Mock };
   let auditService: { run: jest.Mock };
   let sessionStateService: { markSessionRevoked: jest.Mock };
   let service: RefreshAuthSessionService;

   beforeEach(() => {
      prisma = {
         authSession: { findFirst: jest.fn(), update: jest.fn() },
         user: { findUnique: jest.fn() },
      };
      sessionService = { run: jest.fn() };
      auditService = { run: jest.fn() };
      sessionStateService = { markSessionRevoked: jest.fn() };

      service = new RefreshAuthSessionService(
         prisma as any,
         sessionService as any,
         auditService as any,
         sessionStateService as any,
      );
   });

   it('deve propagar selectedSchoolId da sessao anterior para a nova sessao', async () => {
      prisma.authSession.findFirst.mockResolvedValue({
         id: 'session-old',
         userId: 'user-1',
         channel: 'web_admin',
         authDeviceId: 'device-1',
         selectedSchoolId: 'school-1',
         expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.user.findUnique.mockResolvedValue({
         id: 'user-1',
         role: RoleEnum.user,
      });
      sessionService.run.mockResolvedValue({
         session: { sessionId: 'session-new' },
      });

      await service.run({
         channel: 'web_admin' as any,
         refreshToken: 'refresh-token',
      });

      expect(sessionService.run).toHaveBeenCalledWith(
         expect.objectContaining({
            userId: 'user-1',
            selectedSchoolId: 'school-1',
         }),
      );
   });
});
