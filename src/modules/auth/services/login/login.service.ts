import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoginArgs } from '../../args/login.args';

@Injectable()
export class LoginService {
   private readonly logger = new Logger(LoginService.name);

   constructor(
      private readonly prisma: PrismaService,
      private readonly jwtService: JwtService,
   ) {}

   async run({ email, password }: LoginArgs) {
      const normalizedEmail = email.toLowerCase();
      const user = await this.prisma.user.findUnique({
         where: { email: normalizedEmail },
         select: { id: true, encryptedPassword: true, isActive: true },
      });

      const failureMessage = 'Usuário ou senha inválidos';

      if (!user) {
         this.logger.error(failureMessage);
         throw new UnauthorizedException(failureMessage);
      }

      const passwordMatch = await compare(password, user.encryptedPassword);
      if (!passwordMatch) {
         this.logger.error(failureMessage);
         throw new UnauthorizedException(failureMessage);
      }

      if (!user.isActive) {
         const msg = 'Usuário desativado!';
         this.logger.error(msg);
         throw new UnauthorizedException(msg);
      }

      await this.prisma.user.update({
         where: { id: user.id },
         data: { lastSession: new Date() },
      });

      const token = this.jwtService.sign({ sub: user.id });
      return { token };
   }
}
