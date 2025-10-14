import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../user/user.module';
import authConfig, { validateAuthEnv } from './config/auth.config';

import { QueueModule } from '../queue/queue.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthResolver } from './resolvers/auth.resolver';
import { MeResolver } from './resolvers/me.resolver';
import { LoginService } from './services/login/login.service';
import { MeService } from './services/me/me-service/me-service.service';
import { JwtStrategyWs } from './strategies/jwt-graphql-ws.strategy';
import { JwtStrategy } from './strategies/jwt-graphql.strategy';

@Module({
   imports: [
      PrismaModule,
      PassportModule.register({ defaultStrategy: 'jwt' }),
      ConfigModule.forRoot({
         isGlobal: true,
         cache: true,
         load: [authConfig],
         validate: validateAuthEnv,
      }),

      JwtModule.registerAsync({
         imports: [ConfigModule],
         inject: [ConfigService],
         useFactory: (config: ConfigService) => {
            const authConf = config.get('auth');
            return {
               secret: authConf.accessSecret,
               signOptions: { expiresIn: authConf.accessExpiresIn },
            };
         },
      }),

      UserModule,
      QueueModule,
   ],
   providers: [
      { provide: 'APP_GUARD', useClass: JwtAuthGuard },
      JwtStrategy,
      JwtStrategyWs,

      // Resolvers
      AuthResolver,

      // Services
      MeService,
      LoginService,
      MeResolver,
   ],
   exports: [MeService, JwtModule],
})
export class AuthModule {}
