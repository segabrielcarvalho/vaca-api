import { Type } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';
import { Type as TypeClassTransformer } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export interface IGenericUpdateManyInputType<T> {
   update: T[];
}

export function GenericUpdateManyInput<T>(
   classRef: Type<T>,
): Type<IGenericUpdateManyInputType<T>> {
   @InputType({ isAbstract: true })
   abstract class GenericUpdateManyInputType
      implements IGenericUpdateManyInputType<T>
   {
      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => [classRef])
      update: T[];
   }
   return GenericUpdateManyInputType as Type<IGenericUpdateManyInputType<T>>;
}
