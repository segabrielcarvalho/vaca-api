import type { NextFunction, Request, Response } from 'express';
import type { GraphQLScalarType } from 'graphql';

declare module 'graphql-upload' {
   export const GraphQLUpload: GraphQLScalarType;

   export function graphqlUploadExpress(options?: {
      maxFileSize?: number;
      maxFiles?: number;
   }): (req: Request, res: Response, next: NextFunction) => void;

   export interface FileUpload {
      filename: string;
      mimetype: string;
      encoding: string;
      createReadStream(): import('stream').Stream;
   }
}
