import type { RequestHandler } from 'express';
import type { GraphQLScalarType } from 'graphql';
import { dynamicImport } from '../../utils/dynamic-import';
import type { JsonRecord } from 'src/types/json';

type UploadScalarResolver = Pick<
   GraphQLScalarType,
   'parseValue' | 'serialize' | 'parseLiteral'
>;

type UploadMiddlewareOptions = {
   maxFileSize?: number;
   maxFiles?: number;
};

const loadDefault = async <T>(modulePath: string): Promise<T> => {
   const mod = await dynamicImport<JsonRecord>(modulePath);
   return (mod as { default?: T }).default ?? (mod as T);
};

let uploadScalarPromise: Promise<UploadScalarResolver> | undefined;
let uploadMiddlewarePromise: Promise<RequestHandler> | undefined;

export const loadGraphQLUploadScalar =
   async (): Promise<UploadScalarResolver> => {
      uploadScalarPromise ??= loadDefault<UploadScalarResolver>(
         'graphql-upload/GraphQLUpload.mjs',
      );
      return uploadScalarPromise;
   };

export const loadGraphqlUploadMiddleware = async (
   options: UploadMiddlewareOptions,
): Promise<RequestHandler> => {
   if (!uploadMiddlewarePromise) {
      uploadMiddlewarePromise = loadDefault<
         (opts: UploadMiddlewareOptions) => RequestHandler
      >('graphql-upload/graphqlUploadExpress.mjs').then((factory) =>
         factory(options),
      );
   }
   return uploadMiddlewarePromise;
};
