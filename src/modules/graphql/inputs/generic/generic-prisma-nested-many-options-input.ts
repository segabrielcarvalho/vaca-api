import { Type } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';
import { Type as TypeClassTransformer } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export interface IGenericPrismaNestedManyOptionsType<T> {
   create?: T[];
   createOrConnect?: T[];
}

export function GenericPrismaNestedManyOptions<T>(
   classRef: Type<T>,
): Type<IGenericPrismaNestedManyOptionsType<T>> {
   @InputType({ isAbstract: true })
   abstract class GenericPrismaNestedManyOptionsType
      implements IGenericPrismaNestedManyOptionsType<T>
   {
      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => [classRef], { nullable: true })
      create?: T[];

      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => [classRef], { nullable: true })
      createOrConnect?: T[];
   }
   return GenericPrismaNestedManyOptionsType as Type<
      IGenericPrismaNestedManyOptionsType<T>
   >;
}
