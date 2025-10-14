import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GenderEnum, RoleEnum } from '@prisma/client';
import {
   IsBoolean,
   IsDate,
   IsEmail,
   IsEnum,
   IsOptional,
   IsString,
   IsUUID,
} from 'class-validator';

@ObjectType()
export class UserObject {
   @IsUUID()
   @Field(() => ID, { nullable: false })
   id!: string;

   @IsDate()
   @Field(() => Date, { nullable: false })
   createdAt!: Date;

   @IsDate()
   @Field(() => Date, { nullable: false })
   updatedAt!: Date;

   @IsBoolean()
   @Field(() => Boolean, { defaultValue: true, nullable: false })
   isActive!: boolean;

   @IsBoolean()
   @Field(() => Boolean, { defaultValue: false, nullable: false })
   isTest!: boolean;

   @IsString()
   @Field(() => String, { nullable: false })
   name!: string;

   @IsEmail()
   @Field(() => String, { nullable: false })
   email!: string;

   @IsDate()
   @IsOptional()
   @Field(() => Date, { nullable: true })
   lastSession!: Date | null;

   @IsBoolean()
   @Field(() => Boolean, { defaultValue: false, nullable: false })
   verifiedEmail!: boolean;

   @IsEnum(RoleEnum)
   @Field(() => RoleEnum, { nullable: false })
   role!: `${RoleEnum}`;

   @IsEnum(GenderEnum)
   @IsOptional()
   @Field(() => GenderEnum, { nullable: true })
   gender?: `${GenderEnum}` | null;

   // @Field(() => UserAgent, { nullable: true })
   // UserAgent?: UserAgent | null;

   // @Field(() => [Session], { nullable: true })
   // Sessions?: Array<Session>;

   // @Field(() => [Memory], { nullable: true })
   // Memories?: Array<Memory>;

   // @Field(() => [LoginCode], { nullable: true })
   // LoginCodes?: Array<LoginCode>;

   // @Field(() => UserCount, { nullable: false })
   // _count?: UserCount;
}
