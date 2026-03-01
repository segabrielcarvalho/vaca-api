import { Field, InputType } from '@nestjs/graphql';
import { RoleEnum } from '../../graphql/@generated/prisma/role.enum';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

@InputType()
export class InviteUserInput {
   @Field()
   @IsEmail()
   email!: string;

   @Field(() => RoleEnum, { nullable: true })
   @IsOptional()
   @IsEnum(RoleEnum)
   role?: RoleEnum;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   metadataJson?: string;
}
