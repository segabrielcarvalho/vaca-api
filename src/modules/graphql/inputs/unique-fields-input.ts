import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEmail, IsUUID } from 'class-validator';

@InputType()
export class UniqueFieldsInput {
   @IsUUID()
   @Field(() => ID)
   id: string;

   @IsUUID()
   @Field(() => String)
   userId: string;

   @Field(() => String)
   name: string;

   @Field(() => String)
   path: string;

   @IsEmail()
   @Field(() => String)
   email: string;
}
