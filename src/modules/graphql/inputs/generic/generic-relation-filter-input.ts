import { Type } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';
import { Type as TypeClassTransformer } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export interface IGenericRelationFilterInputType<T> {
   every?: T;
   some?: T;
   none?: T;
}

export function GenericRelationFilterInput<T>(
   classRef: Type<T>,
): Type<IGenericRelationFilterInputType<T>> {
   @InputType({ isAbstract: true })
   abstract class GenericRelationFilterInputType
      implements IGenericRelationFilterInputType<T>
   {
      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => classRef, { nullable: true })
      every?: T;

      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => classRef, { nullable: true })
      some?: T;

      @TypeClassTransformer(() => classRef)
      @ValidateNested()
      @Field(() => classRef, { nullable: true })
      none?: T;
   }
   return GenericRelationFilterInputType as Type<
      IGenericRelationFilterInputType<T>
   >;
}
