import { Injectable } from '@nestjs/common';
import { AuthChannelEnum } from '../../../graphql/@generated/prisma/auth-channel.enum';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthSessionInfo } from '../../objects';
import type { AuthCurrentUser } from '../auth-context.service';

@Injectable()
export class MySessionsService {
   constructor(private readonly prisma: PrismaService) {}

   async run(user: AuthCurrentUser): Promise<AuthSessionInfo[]> {
      const sessions = await this.prisma.authSession.findMany({
         where: { userId: user.id },
         orderBy: { createdAt: 'desc' },
      });

      const authDeviceIds = [
         ...new Set(
            sessions
               .map((session) => session.authDeviceId)
               .filter((deviceId): deviceId is string => !!deviceId),
         ),
      ];

      const devices = authDeviceIds.length
         ? await this.prisma.authDevice.findMany({
              where: {
                 id: {
                    in: authDeviceIds,
                 },
              },
           })
         : [];
      const devicesById = new Map(devices.map((device) => [device.id, device]));

      return sessions.map((session) => ({
         ...(session.authDeviceId
            ? { Device: devicesById.get(session.authDeviceId) }
            : {}),
         id: session.id,
         channel: session.channel as unknown as AuthChannelEnum,
         createdAt: session.createdAt,
         expiresAt: session.expiresAt,
         revokedAt: session.revokedAt,
         deviceId: session.authDeviceId
            ? devicesById.get(session.authDeviceId)?.deviceId
            : undefined,
         deviceName: session.authDeviceId
            ? (devicesById.get(session.authDeviceId)?.deviceName ?? undefined)
            : undefined,
         lastSeenAt: session.authDeviceId
            ? devicesById.get(session.authDeviceId)?.lastSeenAt
            : null,
         ip: session.ip ?? undefined,
         userAgent: session.userAgent ?? undefined,
      }));
   }
}
