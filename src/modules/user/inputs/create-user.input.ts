import { Field, InputType, PickType } from '@nestjs/graphql';
import { MenteeTypeEnum } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { UserObject } from '../objects/user.object';

@InputType()
export class CreateUserInput extends PickType(
   UserObject,
   ['name', 'email', 'gender', 'role'] as const,
   InputType,
) {
   @IsEnum(MenteeTypeEnum)
   @Field(() => MenteeTypeEnum, {
      nullable: true,
      defaultValue: MenteeTypeEnum.insider,
   })
   menteeType?: MenteeTypeEnum;
}
