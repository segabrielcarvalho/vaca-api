import {
   ApolloServerPluginLandingPageLocalDefault,
   ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import { KeyvAdapter } from '@apollo/utils.keyvadapter';
import KeyvRedis from '@keyv/redis';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { GraphQLModule as Gql } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import type { RedisPubSub } from 'graphql-redis-subscriptions';
import { graphqlUploadExpress } from 'graphql-upload';
import Keyv from 'keyv';
import { join } from 'path';
import appConfig from '../app/app.config';
import { AuthModule } from '../auth/auth.module';
import type { ICurrentUser } from '../auth/types/auth.types';
import { redisConfig } from '../redis/config/redis.config';
import { REDIS_PUBSUB } from '../redis/redis.constants';
import { RedisModule } from '../redis/redis.module';
import { UploadScalar } from './scalar/upload.scalar';

type JwtPayload = { sub: string };
type ConnVars = { Authorization?: string; authToken?: string };
type WsExtra = { user?: ICurrentUser };

@Module({
   imports: [
      ConfigModule.forFeature(appConfig),
      ConfigModule.forFeature(redisConfig),
      RedisModule,
      AuthModule,
      Gql.forRootAsync<ApolloDriverConfig>({
         driver: ApolloDriver,
         imports: [
            ConfigModule.forFeature(redisConfig),
            ConfigModule.forFeature(appConfig),
            RedisModule,
            AuthModule,
         ],
         inject: [appConfig.KEY, redisConfig.KEY, JwtService, REDIS_PUBSUB],
         useFactory: (
            app: ConfigType<typeof appConfig>,
            redis: ConfigType<typeof redisConfig>,
            jwt: JwtService,
            pubSub: RedisPubSub,
         ): ApolloDriverConfig => {
            const { host = 'localhost', port = 6379, password, db } = redis;
            const redisUrl = password
               ? `redis://:${password}@${host}:${port}/${db.ws ?? 1}`
               : `redis://${host}:${port}/${db.ws ?? 1}`;
            const cache = new KeyvAdapter(
               new Keyv({ store: new KeyvRedis(redisUrl) }),
            );
            const decode = (token?: string): ICurrentUser | undefined => {
               if (!token) return;
               try {
                  const { sub } = jwt.verify(token) as JwtPayload;
                  return { id: sub } as ICurrentUser;
               } catch {
                  return;
               }
            };
            const isProd = app.environment === 'production';
            return {
               autoSchemaFile: join(
                  process.cwd(),
                  'src/modules/graphql/schema.gql',
               ),
               cache,
               sortSchema: true,
               introspection: !isProd,
               playground: false,
               subscriptions: {
                  'graphql-ws': {
                     path: '/graphql',
                     async onConnect(ctx) {
                        const raw =
                           (ctx.connectionParams as ConnVars).Authorization ??
                           (ctx.connectionParams as ConnVars).authToken;

                        const token =
                           typeof raw === 'string'
                              ? raw.split(' ').pop()
                              : undefined;
                        const user = decode(token);
                        if (!user) throw new Error('Unauthorized');
                        (ctx.extra as WsExtra).user = user;
                     },
                  },
               },
               plugins: [
                  isProd
                     ? ApolloServerPluginLandingPageProductionDefault({
                          graphRef: app.apolloGraphRef,
                          footer: false,
                       })
                     : ApolloServerPluginLandingPageLocalDefault({
                          footer: false,
                       }),
               ],
               context: ({ req, res, extra }) => {
                  if ((extra as WsExtra)?.user) {
                     return { user: (extra as WsExtra).user, pubSub };
                  }
                  const auth = req?.headers?.authorization ?? '';
                  const token = auth.startsWith('Bearer ')
                     ? auth.slice(7)
                     : undefined;
                  const user = decode(token);
                  return user
                     ? { req, res, user, pubSub }
                     : { req, res, pubSub };
               },
            };
         },
      }),
   ],
   providers: [UploadScalar],
})
export class GraphQLModule implements NestModule {
   configure(consumer: MiddlewareConsumer) {
      consumer
         .apply(
            graphqlUploadExpress({
               maxFiles: 10,
               maxFileSize: 50 * 1024 * 1024,
            }),
         )
         .forRoutes('graphql');
   }
}
