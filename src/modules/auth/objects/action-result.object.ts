import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ActionResultObject {
   @Field()
   message!: string;

   @Field()
   statusCode!: number;
}
