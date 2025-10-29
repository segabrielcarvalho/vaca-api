import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { LoginArgs } from '../../args/login.args';
import { IssueTokenService } from '../token/issue-token.service';

@Injectable()
export class LoginService {
   private readonly logger = new Logger(LoginService.name);

   constructor(
      private readonly prisma: PrismaService,
      private readonly issueTokenService: IssueTokenService,
   ) {}

   async run({ email, password }: LoginArgs) {
      const normalizedEmail = email.toLowerCase();
      const user = await this.prisma.user.findUnique({
         where: { email: normalizedEmail },
         select: {
            id: true,
            encryptedPassword: true,
            isActive: true,
         },
      });

      const failureMessage = 'Usuário ou senha inválidos';

      if (!user) {
         this.logger.error(failureMessage);
         throw new UnauthorizedException(failureMessage);
      }

      if (!user.encryptedPassword) {
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

      const token = await this.issueTokenService.run(user.id);
      return { token, message: 'Login realizado com sucesso.' };
   }
}
