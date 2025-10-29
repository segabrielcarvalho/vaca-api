import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import authConfig from '../config/auth.config';
import { ICurrentUser } from '../types/auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt-graphql') {
   constructor(
      private readonly prisma: PrismaService,
      @Inject(authConfig.KEY)
      config: ConfigType<typeof authConfig>,
   ) {
      super({
         jwtFromRequest: (context: any): null | string => {
            const bearer = context?.headers?.authorization?.split(' ').pop();
            return bearer;
         },
         secretOrKey: config.accessSecret,
      });
   }

   async validate(payload: any): Promise<ICurrentUser | false> {
      const user = await this.prisma.user.findUnique({
         where: { id: payload.sub },
      });

      if (!user) return false;

      const { encryptedPassword, ...safeUser } = user;

      return safeUser as ICurrentUser;
   }
}
