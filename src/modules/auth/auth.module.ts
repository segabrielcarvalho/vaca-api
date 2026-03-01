import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EmailModule } from '../email/email.module';
import { LoggerModule } from '../logger/logger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import authConfig from './auth.config';
import { GqlAuthGuard } from './guards/gql-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ScopedAccessGuard } from './guards/scoped-access.guard';
import { AuthAccessResolver } from './resolvers/auth-access.resolver';
import { AuthAccountResolver } from './resolvers/auth-account.resolver';
import { AuthInviteResolver } from './resolvers/auth-invite.resolver';
import { AuthMeFieldsResolver } from './resolvers/auth-me-fields.resolver';
import { AuthMeResolver } from './resolvers/auth-me.resolver';
import { AuthSessionTransportResolverHelper } from './resolvers/auth-session-transport.resolver-helper';
import {
   ConsumeEmailLoginMagicLinkService,
   LogoutCurrentSessionService,
   RefreshAuthSessionService,
   StartEmailLoginService,
   VerifyEmailLoginCodeService,
} from './services/access';
import { MeService, MySessionsService } from './services/account';
import { AuthCleanupService } from './services/auth-cleanup.service';
import { AuthContextService } from './services/auth-context.service';
import {
   CompleteInviteProfileService,
   ConsumeInviteMagicLinkService,
   InviteUserService,
   StartInviteAcceptanceService,
   VerifyInviteEmailCodeService,
} from './services/invite';
import {
   AuthAuditService,
   AssertChallengeChannelBindingService,
   AuthChallengeService,
   AuthContextTokenService,
   AuthEmailQueueService,
   AuthInstitutionAccessService,
   AuthRedisService,
   AuthSessionService,
   AuthSessionStateService,
   ConsumeInviteChallengeService,
   GetActiveInviteByTokenService,
   ScopedAccessService,
   ValidateCsrfTokenService,
} from './services/shared';

@Module({
   imports: [
      ConfigModule.forFeature(authConfig),
      JwtModule.registerAsync({
         imports: [ConfigModule.forFeature(authConfig)],
         inject: [authConfig.KEY],
         useFactory: (config: ConfigType<typeof authConfig>) => ({
            secret: config.jwt.accessSecret,
         }),
      }),
      PrismaModule,
      EmailModule,
      LoggerModule,
      QueueModule,
      StorageModule,
   ],
   providers: [
      AuthContextService,
      AuthAuditService,
      AssertChallengeChannelBindingService,
      AuthChallengeService,
      AuthContextTokenService,
      AuthEmailQueueService,
      AuthInstitutionAccessService,
      AuthRedisService,
      AuthSessionService,
      AuthSessionStateService,
      GetActiveInviteByTokenService,
      ConsumeInviteChallengeService,
      ValidateCsrfTokenService,
      ScopedAccessService,
      InviteUserService,
      StartInviteAcceptanceService,
      VerifyInviteEmailCodeService,
      ConsumeInviteMagicLinkService,
      CompleteInviteProfileService,
      StartEmailLoginService,
      VerifyEmailLoginCodeService,
      ConsumeEmailLoginMagicLinkService,
      RefreshAuthSessionService,
      LogoutCurrentSessionService,
      MeService,
      MySessionsService,
      AuthSessionTransportResolverHelper,
      AuthInviteResolver,
      AuthAccessResolver,
      AuthAccountResolver,
      AuthMeResolver,
      AuthMeFieldsResolver,
      AuthCleanupService,
      RolesGuard,
      ScopedAccessGuard,
      {
         provide: APP_GUARD,
         useClass: GqlAuthGuard,
      },
   ],
   exports: [
      AuthContextService,
      JwtModule,
      RolesGuard,
      ScopedAccessService,
      InviteUserService,
   ],
})
export class AuthModule {}
