import { Type } from '@nestjs/common';
import { Field, InputType } from '@nestjs/graphql';
import { Type as TypeClassTransformer } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export interface IGenericConnectManyInputType<T> {
   connect?: T[];
   disconnect?: T[];
}

export function GenericConnectDisconnectManyInput<T>(
   classRef: Type<T>,
): Type<IGenericConnectManyInputType<T>> {
   @InputType({ isAbstract: true })
   abstract class GenericConnectManyInputType
      implements IGenericConnectManyInputType<T>
   {
      @TypeClassTransformer(() => classRef)
      @ValidateNested({ each: true })
      @Field(() => [classRef], { nullable: true })
      connect?: T[];

      @TypeClassTransformer(() => classRef)
      @ValidateNested({ each: true })
      @Field(() => [classRef], { nullable: true })
      disconnect?: T[];
   }

   return GenericConnectManyInputType as Type<IGenericConnectManyInputType<T>>;
}
