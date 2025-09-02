import {
   BadRequestException,
   ConflictException,
   GoneException,
   Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { ValidateCodeArgs } from '../../args/validate-code.args';
import { TokenPairObject } from '../../objects/token-pair.object';

@Injectable()
export class ValidateCodeService {
   constructor(
      private readonly prisma: PrismaService,
      private readonly jwtService: JwtService,
      private readonly config: ConfigService,
   ) {}

   async run({ code, token }: ValidateCodeArgs): Promise<TokenPairObject> {
      const dbCode = await this.prisma.loginCode.findUnique({
         where: { token },
         include: { User: true },
      });

      if (!dbCode || dbCode.code !== code)
         throw new BadRequestException('Código ou token inválido');

      if (dbCode.used)
         throw new ConflictException('Este código já foi utilizado');

      if (dbCode.expiresAt.getTime() < Date.now())
         throw new GoneException('Código expirado');

      await this.prisma.loginCode.update({
         where: { id: dbCode.id },
         data: { used: true, usedAt: new Date() },
      });

      const user = dbCode.User;
      if (!user) {
         throw new BadRequestException('Usuário associado não encontrado');
      }

      const accessToken = this.jwtService.sign(
         { sub: user.id, email: user.email, role: user.role },
         {
            secret: this.config.get('auth.accessSecret'),
            expiresIn: this.config.get('auth.accessExpiresIn'),
         },
      );

      const refreshToken = this.jwtService.sign(
         { sub: user.id },
         {
            secret: this.config.get('auth.refreshSecret'),
            expiresIn: this.config.get('auth.refreshExpiresIn'),
         },
      );

      const refreshTtlMs = this.parseExpiresIn(
         this.config.get('auth.refreshExpiresIn'),
      );

      await this.prisma.refreshToken.create({
         data: {
            token: refreshToken,
            expiresAt: new Date(Date.now() + refreshTtlMs),
            userId: user.id,
         },
      });

      return { accessToken, refreshToken };
   }

   private parseExpiresIn(exp: string): number {
      const timeUnits = { s: 1e3, m: 6e4, h: 3.6e6, d: 8.64e7 };
      const [, value, unit] = exp.match(/^(\d+)([smhd])$/) || [];
      return value && unit
         ? parseInt(value, 10) * timeUnits[unit as keyof typeof timeUnits]
         : 0;
   }
}
