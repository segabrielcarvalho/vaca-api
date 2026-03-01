import type { User } from '../../../../../.prisma/client';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthCurrentUser } from '../auth-context.service';

@Injectable()
export class MeService {
   constructor(private readonly prisma: PrismaService) {}

   async run(user: AuthCurrentUser): Promise<User> {
      const currentUser = await this.prisma.user.findUnique({
         where: { id: user.id },
      });

      if (!currentUser) {
         throw new UnauthorizedException('Usuário nao encontrado.');
      }

      return currentUser;
   }
}
