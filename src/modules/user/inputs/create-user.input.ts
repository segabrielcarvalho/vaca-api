import { InputType, PickType } from '@nestjs/graphql';
import { UserObject } from '../objects/user.object';

@InputType()
export class CreateUserInput extends PickType(
   UserObject,
   ['name', 'email', 'gender', 'role'] as const,
   InputType,
) {}
