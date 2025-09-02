import { Type } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';
import { Type as TypeClassTransformer } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export interface IGenericRelationIsIsNotFilterInputType<T> {
   is?: T;
   isNot?: T;
}

export function GenericRelationIsIsNotFilterInput<T>(
   classRef: Type<T>,
): Type<IGenericRelationIsIsNotFilterInputType<T>> {
   @InputType({ isAbstract: true })
   abstract class GenericRelationIsIsNotFilterInputType
      implements IGenericRelationIsIsNotFilterInputType<T>
   {
      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => classRef, { nullable: true })
      is?: T;

      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => classRef, { nullable: true })
      isNot?: T;
   }
   return GenericRelationIsIsNotFilterInputType as Type<
      IGenericRelationIsIsNotFilterInputType<T>
   >;
}
