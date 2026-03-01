import { OnModuleInit } from '@nestjs/common';
import { Scalar } from '@nestjs/graphql';
import type { GraphQLScalarType, ValueNode } from 'graphql';
import { loadGraphQLUploadScalar } from '../graphql-upload';
import type { JsonRecord, JsonValue } from 'src/types/json';

type UploadScalarResolver = Pick<
   GraphQLScalarType,
   'parseValue' | 'serialize' | 'parseLiteral'
>;

@Scalar('Upload')
export class UploadScalar implements OnModuleInit {
   private delegate?: UploadScalarResolver;

   async onModuleInit() {
      this.delegate = await loadGraphQLUploadScalar();
   }

   private getDelegate() {
      if (!this.delegate) {
         throw new Error('Scalar de upload não inicializado');
      }
      return this.delegate;
   }

   parseValue = (value: JsonValue) => this.getDelegate().parseValue(value);

   serialize = (value: JsonValue) => this.getDelegate().serialize(value);

   parseLiteral = (value: ValueNode, variables?: JsonRecord) =>
      this.getDelegate().parseLiteral(value, variables);
}
