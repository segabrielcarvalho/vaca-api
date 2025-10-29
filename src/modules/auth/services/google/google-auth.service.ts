import {
   Inject,
   Injectable,
   Logger,
   UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { RoleEnum } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../../../prisma/prisma.service';
import googleAuthConfig from '../../config/google.config';
import { ICurrentUser } from '../../types/auth.types';

type GoogleTokenResponse = {
   access_token: string;
   id_token: string;
   expires_in: number;
   refresh_token?: string;
   scope: string;
   token_type: string;
};

type GoogleUserInfoResponse = {
   id: string;
   email: string;
   verified_email: boolean;
   name?: string;
   given_name?: string;
   family_name?: string;
   picture?: string;
};

@Injectable()
export class GoogleAuthService {
   private readonly logger = new Logger(GoogleAuthService.name);

   constructor(
      @Inject(googleAuthConfig.KEY)
      private readonly googleConfig: ConfigType<typeof googleAuthConfig>,
      private readonly prisma: PrismaService,
   ) {}

   async authenticateWithCode(code: string): Promise<ICurrentUser> {
      const tokens = await this.exchangeCode(code);
      const profile = await this.fetchUserProfile(tokens.access_token);
      return this.upsertUser(profile);
   }

   private async exchangeCode(code: string): Promise<GoogleTokenResponse> {
      try {
         const body = new URLSearchParams({
            code,
            client_id: this.googleConfig.clientId,
            client_secret: this.googleConfig.clientSecret,
            redirect_uri: this.googleConfig.callbackUrl,
            grant_type: 'authorization_code',
         });

         const { data } = await axios.post<GoogleTokenResponse>(
            'https://oauth2.googleapis.com/token',
            body.toString(),
            {
               headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
               },
            },
         );

         if (!data.access_token) {
            throw new UnauthorizedException(
               'Token de acesso do Google ausente.',
            );
         }

         return data;
      } catch (error) {
         this.logger.error(
            'Erro ao trocar código pelo token do Google',
            error instanceof Error ? error.stack : JSON.stringify(error),
         );
         throw new UnauthorizedException(
            'Não foi possível autenticar com as credenciais do Google.',
         );
      }
   }

   private async fetchUserProfile(
      accessToken: string,
   ): Promise<GoogleUserInfoResponse> {
      try {
         const { data } = await axios.get<GoogleUserInfoResponse>(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            {
               headers: { Authorization: `Bearer ${accessToken}` },
            },
         );

         if (!data.email) {
            throw new UnauthorizedException(
               'O Google não retornou um e-mail válido.',
            );
         }

         return data;
      } catch (error) {
         this.logger.error(
            'Erro ao buscar perfil do usuário no Google',
            error instanceof Error ? error.stack : JSON.stringify(error),
         );
         throw new UnauthorizedException(
            'Não foi possível obter os dados do usuário com o Google.',
         );
      }
   }

   private async upsertUser(
      profile: GoogleUserInfoResponse,
   ): Promise<ICurrentUser> {
      const normalizedEmail = profile.email.toLowerCase();
      const displayName =
         profile.name ??
         [profile.given_name, profile.family_name].filter(Boolean).join(' ') ??
         normalizedEmail;

      const existing = await this.prisma.user.findUnique({
         where: { email: normalizedEmail },
      });

      if (existing) {
         if (!existing.isActive) {
            throw new UnauthorizedException('Usuário desativado!');
         }
         const { encryptedPassword, ...safeUser } = existing;
         void encryptedPassword;
         return safeUser as ICurrentUser;
      }

      const created = await this.prisma.user.create({
         data: {
            email: normalizedEmail,
            name: displayName,
            role: RoleEnum.user,
            encryptedPassword: null,
            verifiedEmail: profile.verified_email ?? false,
         },
      });

      const { encryptedPassword, ...safeUser } = created;
      void encryptedPassword;
      return safeUser as ICurrentUser;
   }
}
