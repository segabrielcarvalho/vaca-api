import { Type } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';
import { Type as TypeClassTransformer } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export interface IGenericUpdateOneInputType<T> {
   update: T;
}

export function GenericUpdateOneInput<T>(
   classRef: Type<T>,
): Type<IGenericUpdateOneInputType<T>> {
   @InputType({ isAbstract: true })
   abstract class GenericUpdateOneInputType
      implements IGenericUpdateOneInputType<T>
   {
      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => classRef)
      update: T;
   }
   return GenericUpdateOneInputType as Type<IGenericUpdateOneInputType<T>>;
}
