import { Field, InputType, PickType } from '@nestjs/graphql';
import { IsNotEmpty, MinLength } from 'class-validator';
import { UserObject } from '../objects/user.object';

@InputType()
export class CreateUserInput extends PickType(
   UserObject,
   ['name', 'email', 'gender', 'role'] as const,
   InputType,
){
   @Field(() => String)
   @IsNotEmpty()
   @MinLength(8)
   password!: string;
}
