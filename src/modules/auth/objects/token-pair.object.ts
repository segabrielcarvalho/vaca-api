import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TokenPairObject {
   @Field(() => String)
   refreshToken: string;

   @Field(() => String)
   accessToken: string;
}
