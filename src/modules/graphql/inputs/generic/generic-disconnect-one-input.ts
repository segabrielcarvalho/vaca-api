import { Type } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';
import { Type as TypeClassTransformer } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export interface IGenericDisconnectOneInputType<T> {
   disconnect: T;
}

export function GenericDisconnectOneInput<T>(
   classRef: Type<T>,
): Type<IGenericDisconnectOneInputType<T>> {
   @InputType({ isAbstract: true })
   abstract class GenericDisconnectOneInputType
      implements IGenericDisconnectOneInputType<T>
   {
      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => classRef)
      disconnect: T;
   }
   return GenericDisconnectOneInputType as Type<
      IGenericDisconnectOneInputType<T>
   >;
}
