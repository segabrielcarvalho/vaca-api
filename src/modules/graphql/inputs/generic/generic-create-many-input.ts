import { Type } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';
import { Type as TypeClassTransformer } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export interface IGenericCreateManyInputType<T> {
   create: T[];
}

export function GenericCreateManyInput<T>(
   classRef: Type<T>,
): Type<IGenericCreateManyInputType<T>> {
   @InputType({ isAbstract: true })
   abstract class GenericCreateManyInputType
      implements IGenericCreateManyInputType<T>
   {
      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => [classRef])
      create: T[];
   }
   return GenericCreateManyInputType as Type<IGenericCreateManyInputType<T>>;
}
