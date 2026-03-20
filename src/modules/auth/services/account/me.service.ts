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
         include: {
            Agent: {
               include: {
                  Memberships: {
                     include: {
                        Role: {
                           select: {
                              code: true,
                           },
                        },
                        Klass: {
                           select: {
                              id: true,
                              courseId: true,
                              Course: {
                                 select: {
                                    id: true,
                                    schoolId: true,
                                    name: true,
                                    isActive: true,
                                 },
                              },
                           },
                        },
                     },
                  },
               },
            },
         },
      });

      if (!currentUser) {
         throw new UnauthorizedException('Usuário nao encontrado.');
      }

      return currentUser;
   }
}
