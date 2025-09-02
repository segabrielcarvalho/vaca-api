import { Type } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';
import { Type as TypeClassTransformer } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export interface IGenericPrismaNestedOneOptionsType<T> {
   create?: T;
   createOrConnect?: T;
   connect?: T;
}

export function GenericPrismaNestedOneOptions<T>(
   classRef: Type<T>,
): Type<IGenericPrismaNestedOneOptionsType<T>> {
   @InputType({ isAbstract: true })
   abstract class GenericPrismaNestedOneOptionsType
      implements IGenericPrismaNestedOneOptionsType<T>
   {
      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => classRef, { nullable: true })
      create?: T;

      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => classRef, { nullable: true })
      createOrConnect?: T;

      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => classRef, { nullable: true })
      connect?: T;
   }
   return GenericPrismaNestedOneOptionsType as Type<
      IGenericPrismaNestedOneOptionsType<T>
   >;
}
