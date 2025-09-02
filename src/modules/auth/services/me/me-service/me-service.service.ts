import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ICurrentUser } from '../../../types/auth.types';

@Injectable()
export class MeService {
   constructor(private readonly prisma: PrismaService) {}

   async run(currentUser: ICurrentUser) {
      const userResponse = await this.prisma.user.findUnique({
         where: { id: currentUser.id },
      });
      return userResponse;
   }
}
