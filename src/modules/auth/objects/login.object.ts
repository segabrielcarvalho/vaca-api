import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class LoginObject {
   @Field(() => String)
   token: string;

   @Field(() => String)
   message: string;
}
