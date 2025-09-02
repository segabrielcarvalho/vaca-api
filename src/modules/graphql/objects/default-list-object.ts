import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ isAbstract: true })
export abstract class DefaultListObject {
   @Field(() => Int)
   count!: number;

   abstract rows: unknown[];
}
