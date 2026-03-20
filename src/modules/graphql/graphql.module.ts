import responseCachePlugin from '@apollo/server-plugin-response-cache';
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
import type { Request, RequestHandler } from 'express';
import depthLimit from 'graphql-depth-limit';
import type { RedisPubSub } from 'graphql-redis-subscriptions';
import Keyv from 'keyv';
import { join } from 'path';
import appConfig from '../app/app.config';
import { AuthModule } from '../auth/auth.module';
import { AuthContextService } from '../auth/services/auth-context.service';
import type { AuthCurrentUser } from '../auth/services/auth-context.service';
import type { JsonRecord } from 'src/types/json';
import { redisConfig } from '../redis/config/redis.config';
import { REDIS_PUBSUB } from '../redis/redis.constants';
import { RedisModule } from '../redis/redis.module';
import { loadGraphqlUploadMiddleware } from './graphql-upload';
import { DecimalScalar } from './scalar/decimal.scalar';
import { UploadScalar } from './scalar/upload.scalar';

type WsExtra = {
   request?: Request;
   user?: AuthCurrentUser;
};

@Module({
   imports: [
      ConfigModule,
      RedisModule,
      AuthModule,
      Gql.forRootAsync<ApolloDriverConfig>({
         driver: ApolloDriver,
         imports: [ConfigModule, RedisModule, AuthModule],
         inject: [
            appConfig.KEY,
            redisConfig.KEY,
            AuthContextService,
            REDIS_PUBSUB,
         ],
         useFactory: (
            app: ConfigType<typeof appConfig>,
            redis: ConfigType<typeof redisConfig>,
            authContextService: AuthContextService,
            pubSub: RedisPubSub,
         ): ApolloDriverConfig => {
            const redisUrl = redis.buildUrl(redis.db.ws ?? 1);
            const cache = new KeyvAdapter(
               new Keyv({ store: new KeyvRedis(redisUrl) }),
            );
            const maxDepth = app.graphqlMaxDepth ?? 8;
            const persistedQueryTtl = app.graphqlPersistedQueryTtlSec ?? 300;
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
               csrfPrevention: true,
               validationRules: [depthLimit(maxDepth)],
               subscriptions: {
                  'graphql-ws': {
                     path: '/graphql',
                     async onConnect(ctx) {
                        const params = (ctx.connectionParams ??
                           {}) as JsonRecord;
                        const rawCandidates = [
                           params.Authorization,
                           params.authorization,
                           params.authToken,
                           params.token,
                        ];
                        const raw = rawCandidates.find(
                           (value): value is string =>
                              typeof value === 'string',
                        );

                        const token =
                           typeof raw === 'string'
                              ? raw.startsWith('Bearer ')
                                 ? raw.slice(7)
                                 : raw
                              : undefined;

                        const user =
                           await authContextService.resolveAuthenticatedUserFromToken(
                              token,
                           );
                        if (!user) throw new Error('Não autorizado');
                        (ctx.extra as WsExtra).user = user;
                     },
                  },
               },

               plugins: [
                  responseCachePlugin({
                     sessionId: ({ contextValue }) =>
                        contextValue?.user?.id ?? null,
                  }),
                  isProd
                     ? ApolloServerPluginLandingPageProductionDefault({
                          graphRef: app.apolloGraphRef,
                          footer: false,
                       })
                     : ApolloServerPluginLandingPageLocalDefault({
                          footer: false,
                       }),
               ],
               persistedQueries: {
                  ttl: persistedQueryTtl,
               },
               context: async ({ req, res, extra }) => {
                  const wsExtra = extra as WsExtra | undefined;
                  if (wsExtra?.user) {
                     return wsExtra.request
                        ? { req: wsExtra.request, user: wsExtra.user, pubSub }
                        : { user: wsExtra.user, pubSub };
                  }
                  const user =
                     await authContextService.resolveAuthenticatedUserFromRequest(
                        req,
                     );
                  return user
                     ? { req, res, user, pubSub }
                     : { req, res, pubSub };
               },
            };
         },
      }),
   ],
   providers: [UploadScalar, DecimalScalar],
})
export class GraphQLModule implements NestModule {
   configure(consumer: MiddlewareConsumer) {
      const uploadOptions = {
         maxFiles: 10,
         maxFileSize: 50 * 1024 * 1024,
      };
      let uploadMiddlewarePromise: Promise<RequestHandler> | undefined;
      const getUploadMiddleware = () => {
         if (!uploadMiddlewarePromise) {
            uploadMiddlewarePromise =
               loadGraphqlUploadMiddleware(uploadOptions);
         }
         return uploadMiddlewarePromise;
      };
      const uploadMiddleware: RequestHandler = (req, res, next) => {
         getUploadMiddleware()
            .then((middleware) => middleware(req, res, next))
            .catch(next);
      };

      consumer.apply(uploadMiddleware).forRoutes('graphql');
   }
}
