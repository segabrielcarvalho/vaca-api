import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AppLegalLinksObject {
   @Field({ nullable: true })
   termsUrl?: string;

   @Field({ nullable: true })
   privacyUrl?: string;
}
