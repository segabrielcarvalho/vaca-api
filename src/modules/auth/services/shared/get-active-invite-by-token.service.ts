import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { createTokenHash } from '../../utils/auth-crypto.util';

@Injectable()
export class GetActiveInviteByTokenService {
   constructor(private readonly prisma: PrismaService) {}

   async run(rawToken: string) {
      const invite = await this.prisma.authInvite.findUnique({
         where: { tokenHash: createTokenHash(rawToken) },
      });

      if (!invite) {
         throw new UnauthorizedException('Convite invalido.');
      }

      if (invite.revokedAt) {
         throw new UnauthorizedException('Convite revogado.');
      }

      if (invite.acceptedAt) {
         throw new UnauthorizedException('Convite ja utilizado.');
      }

      if (invite.expiresAt.getTime() <= Date.now()) {
         throw new UnauthorizedException('Convite expirado.');
      }

      return invite;
   }
}
