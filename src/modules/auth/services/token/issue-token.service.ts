import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class IssueTokenService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly jwtService: JwtService,
   ) {}

   async run(userId: string) {
      await this.prisma.user.update({
         where: { id: userId },
         data: { lastSession: new Date() },
      });

      return this.jwtService.sign({ sub: userId });
   }
}
