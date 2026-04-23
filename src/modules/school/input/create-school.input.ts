import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class CreateSchoolInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   name!: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   institutionCode?: string | null;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   description?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   bannerPath?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   logoFullPath?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   logoMarkPath?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   faviconPath?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   primaryColor?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   secondaryColor?: string;

   @Field({ nullable: true })
   @IsOptional()
   @IsBoolean()
   isActive?: boolean;
}
