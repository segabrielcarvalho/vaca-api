import { AuthChannelEnum as PrismaAuthChannelEnum } from '../../../../../.prisma/client';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthChannelEnum as GraphQLAuthChannelEnum } from '../../../graphql/@generated/prisma/auth-channel.enum';
import authConfig from '../../auth.config';
import { AuthContextService } from '../auth-context.service';
import type { AuthContextTokenPayload } from '../auth-context.service';

@Injectable()
export class AuthContextTokenService {
   constructor(
      private readonly authContextService: AuthContextService,
      private readonly jwtService: JwtService,
      @Inject(authConfig.KEY)
      private readonly config: ConfigType<typeof authConfig>,
   ) {}

   assertContext(
      contextToken: string,
      allowedScopes: string[],
   ): AuthContextTokenPayload {
      const payload = this.authContextService.decodeContextToken(contextToken);
      if (!payload) {
         throw new UnauthorizedException('Contexto de autenticacao invalido.');
      }
      if (!allowedScopes.includes(payload.scope)) {
         throw new UnauthorizedException('Escopo de contexto invalido.');
      }
      return payload;
   }

   assertContextDeviceBinding(
      context: AuthContextTokenPayload,
      deviceId: string,
      channel: GraphQLAuthChannelEnum,
   ) {
      if (context.channel !== (channel as PrismaAuthChannelEnum)) {
         throw new UnauthorizedException('Canal do contexto invalido.');
      }

      if (context.deviceId && context.deviceId !== deviceId) {
         throw new UnauthorizedException(
            'Dispositivo nao autorizado para este contexto.',
         );
      }
   }

   createContextToken(
      payload: AuthContextTokenPayload,
      expiresInSec: number,
   ): string {
      return this.jwtService.sign(payload, {
         secret: this.config.jwt.contextSecret,
         expiresIn: expiresInSec,
      });
   }
}
