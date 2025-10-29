import {
   BadRequestException,
   Controller,
   Get,
   Logger,
   Query,
   Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { GoogleAuthService } from '../services/google/google-auth.service';
import { GoogleStateService } from '../services/google/google-state.service';
import { IssueTokenService } from '../services/token/issue-token.service';

@Controller('auth/google')
export class GoogleAuthController {
   private readonly logger = new Logger(GoogleAuthController.name);

   constructor(
      private readonly googleAuthService: GoogleAuthService,
      private readonly issueTokenService: IssueTokenService,
      private readonly configService: ConfigService,
      private readonly googleStateService: GoogleStateService,
   ) {}

   @Public()
   @Get()
   async redirectToGoogle(
      @Res() res: Response,
      @Query('redirect') redirect?: string,
   ) {
      const state = this.googleStateService.issueState(redirect);

      const googleConfig = this.configService.get('googleAuth');
      if (!googleConfig) {
         throw new BadRequestException(
            'Configurações do Google não foram carregadas.',
         );
      }

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', googleConfig.clientId);
      authUrl.searchParams.set('redirect_uri', googleConfig.callbackUrl);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', state);

      this.logger.log('Redirecionando usuário para autenticação com o Google');
      return res.redirect(authUrl.toString());
   }

   @Public()
   @Get('callback')
   async handleCallback(
      @Res() res: Response,
      @Query('code') code?: string,
      @Query('state') state?: string,
      @Query('error') error?: string,
   ) {
      if (error) {
         this.logger.error(`Google OAuth retornou erro: ${error}`);
         throw new BadRequestException(
            'Não foi possível concluir a autenticação com o Google.',
         );
      }

      if (!code) {
         throw new BadRequestException(
            'Código de autorização do Google ausente.',
         );
      }

      const stateData = this.googleStateService.consumeState(state);
      if (!stateData) {
         this.logger.warn('Estado inválido detectado no callback do Google');
         throw new BadRequestException(
            'Estado inválido para autenticação Google.',
         );
      }

      const user = await this.googleAuthService.authenticateWithCode(code);
      const token = await this.issueTokenService.run(user.id);
      const redirectUrl = this.buildRedirectUrl(token, stateData.redirect);

      return res.redirect(redirectUrl);
   }

   private buildRedirectUrl(token: string, redirect?: string) {
      const googleConfig = this.configService.get('googleAuth');
      const appConfig = this.configService.get('app');

      if (!appConfig) {
         throw new BadRequestException(
            'Configurações da aplicação não foram carregadas.',
         );
      }

      const baseRedirect =
         googleConfig?.redirectUrl && googleConfig.redirectUrl.length > 0
            ? googleConfig.redirectUrl
            : appConfig.baseWebUrl;

      const redirectUrl = new URL(baseRedirect);
      redirectUrl.searchParams.set('token', token);
      if (redirect) {
         redirectUrl.searchParams.set('redirect', redirect);
      }

      return redirectUrl.toString();
   }
}
