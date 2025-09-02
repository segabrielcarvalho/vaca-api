import { Type } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';
import { Type as TypeClassTransformer } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export interface IGenericUpsertOneInputType<T> {
   upsert: T;
}

export function GenericUpsertOneInput<T>(
   classRef: Type<T>,
): Type<IGenericUpsertOneInputType<T>> {
   @InputType({ isAbstract: true })
   abstract class GenericUpsertOneInputType
      implements IGenericUpsertOneInputType<T>
   {
      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => classRef)
      upsert: T;
   }
   return GenericUpsertOneInputType as Type<IGenericUpsertOneInputType<T>>;
}
