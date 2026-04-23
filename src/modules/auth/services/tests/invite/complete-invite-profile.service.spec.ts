import { BadRequestException } from '@nestjs/common';
import { CompleteInviteProfileService } from '../../invite/complete-invite-profile.service';

describe('CompleteInviteProfileService', () => {
   let prisma: {
      authInvite: { findUnique: jest.Mock; update: jest.Mock };
      authDevice: { upsert: jest.Mock };
      user: { update: jest.Mock };
      userProfile: { upsert: jest.Mock };
      $transaction: jest.Mock;
   };
   let contextTokenService: { assertContext: jest.Mock };
   let auditService: { run: jest.Mock };
   let sessionService: { run: jest.Mock };
   let storageProvider: { saveFileFromBase64: jest.Mock };
   let service: CompleteInviteProfileService;

   beforeEach(() => {
      prisma = {
         authInvite: { findUnique: jest.fn(), update: jest.fn() },
         authDevice: { upsert: jest.fn() },
         user: { update: jest.fn() },
         userProfile: { upsert: jest.fn() },
         $transaction: jest.fn(),
      };
      contextTokenService = { assertContext: jest.fn() };
      auditService = { run: jest.fn() };
      sessionService = { run: jest.fn() };
      storageProvider = { saveFileFromBase64: jest.fn() };

      prisma.user.update.mockResolvedValue({});
      prisma.userProfile.upsert.mockResolvedValue({});
      prisma.$transaction.mockImplementation(async (operations: unknown[]) =>
         Promise.all(operations as Promise<unknown>[]),
      );

      service = new CompleteInviteProfileService(
         prisma as any,
         contextTokenService as any,
         auditService as any,
         sessionService as any,
         storageProvider as any,
      );
   });

   it('deve concluir onboarding, marcar acceptedAt e emitir sessao', async () => {
      const metadata = JSON.stringify({
         source: 'school_members_admin',
         schoolId: 'school-1',
      });

      contextTokenService.assertContext.mockReturnValue({
         userId: 'user-1',
         inviteId: 'invite-1',
         channel: 'web_admin',
      });
      prisma.authInvite.findUnique.mockResolvedValue({
         id: 'invite-1',
         userId: 'user-1',
         email: 'teacher@vaca.dev',
         role: 'user',
         metadata: { raw: metadata },
         expiresAt: new Date(Date.now() + 60_000),
         acceptedAt: null,
         revokedAt: null,
      });
      prisma.authDevice.upsert.mockResolvedValue({ id: 'auth-device-1' });
      prisma.authInvite.update.mockResolvedValue({});
      storageProvider.saveFileFromBase64.mockResolvedValue('photo-path');
      sessionService.run.mockResolvedValue({
         session: {
            sessionId: 'session-1',
            channel: 'web_admin',
            requiresCookieWrite: true,
            selectedSchoolId: 'school-1',
            accessTokenExpiresAt: new Date('2026-04-05T12:10:00.000Z'),
            refreshTokenExpiresAt: new Date('2026-04-05T13:10:00.000Z'),
         },
      });

      const result = await service.run(
         {
            contextId: 'context-1',
            channel: 'web_admin' as any,
            deviceId: 'device-1',
            deviceName: 'Chrome (Linux)',
            name: 'Teacher One',
            phoneE164: '+5511999999999',
            photoBase64: 'data:image/png;base64,AAA',
            timezone: 'America/Sao_Paulo',
            locale: 'pt-BR',
            notificationPrefsJson: '{}',
         },
         { ip: '127.0.0.1' },
      );

      expect(prisma.authDevice.upsert).toHaveBeenCalledWith(
         expect.objectContaining({
            where: {
               userId_channel_deviceId: {
                  userId: 'user-1',
                  channel: 'web_admin',
                  deviceId: 'device-1',
               },
            },
         }),
      );
      expect(prisma.authInvite.update).toHaveBeenCalledWith(
         expect.objectContaining({
            where: { id: 'invite-1' },
            data: expect.objectContaining({
               acceptedAt: expect.any(Date),
            }),
         }),
      );
      expect(sessionService.run).toHaveBeenCalledWith(
         expect.objectContaining({
            userId: 'user-1',
            selectedSchoolId: 'school-1',
            authDeviceId: 'auth-device-1',
         }),
      );
      expect(result).toEqual(
         expect.objectContaining({
            sessionId: 'session-1',
            selectedSchoolId: 'school-1',
         }),
      );
   });

   it('deve falhar quando o metadata institucional for invalido', async () => {
      contextTokenService.assertContext.mockReturnValue({
         userId: 'user-1',
         inviteId: 'invite-1',
         channel: 'web_admin',
      });
      prisma.authInvite.findUnique.mockResolvedValue({
         id: 'invite-1',
         userId: 'user-1',
         role: 'user',
         metadata: { raw: '{"source":"school_members_admin"}' },
         expiresAt: new Date(Date.now() + 60_000),
         acceptedAt: null,
         revokedAt: null,
      });

      await expect(
         service.run({
            contextId: 'context-1',
            channel: 'web_admin' as any,
            deviceId: 'device-1',
            name: 'Teacher One',
            phoneE164: '+5511999999999',
            photoBase64: 'data:image/png;base64,AAA',
            timezone: 'America/Sao_Paulo',
            locale: 'pt-BR',
            notificationPrefsJson: '{}',
         }),
      ).rejects.toThrow(BadRequestException);
   });

   it('deve falhar quando o telefone nao estiver em E.164', async () => {
      contextTokenService.assertContext.mockReturnValue({
         userId: 'user-1',
         inviteId: 'invite-1',
         channel: 'web_admin',
      });
      prisma.authInvite.findUnique.mockResolvedValue({
         id: 'invite-1',
         userId: 'user-1',
         role: 'user',
         metadata: {
            raw: '{"source":"school_members_admin","schoolId":"school-1"}',
         },
         expiresAt: new Date(Date.now() + 60_000),
         acceptedAt: null,
         revokedAt: null,
      });

      await expect(
         service.run({
            contextId: 'context-1',
            channel: 'web_admin' as any,
            deviceId: 'device-1',
            name: 'Teacher One',
            phoneE164: '11999999999',
            photoBase64: 'data:image/png;base64,AAA',
            timezone: 'America/Sao_Paulo',
            locale: 'pt-BR',
            notificationPrefsJson: '{}',
         }),
      ).rejects.toThrow(BadRequestException);
   });

   it('deve falhar quando o convite estiver revogado ou aceito', async () => {
      contextTokenService.assertContext.mockReturnValue({
         userId: 'user-1',
         inviteId: 'invite-1',
         channel: 'web_admin',
      });
      prisma.authInvite.findUnique.mockResolvedValue({
         id: 'invite-1',
         userId: 'user-1',
         role: 'user',
         metadata: {
            raw: '{"source":"school_members_admin","schoolId":"school-1"}',
         },
         expiresAt: new Date(Date.now() + 60_000),
         acceptedAt: new Date(),
         revokedAt: null,
      });

      await expect(
         service.run({
            contextId: 'context-1',
            channel: 'web_admin' as any,
            deviceId: 'device-1',
            name: 'Teacher One',
            phoneE164: '+5511999999999',
            photoBase64: 'data:image/png;base64,AAA',
            timezone: 'America/Sao_Paulo',
            locale: 'pt-BR',
            notificationPrefsJson: '{}',
         }),
      ).rejects.toThrow(BadRequestException);
   });
});
