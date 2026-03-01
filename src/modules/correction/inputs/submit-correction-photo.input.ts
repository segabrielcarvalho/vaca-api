import { Field, Float, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { UploadScalar } from '../../graphql/scalar/upload.scalar';

type UploadFileLike = {
   createReadStream: () => NodeJS.ReadableStream;
};

type UploadReference = Promise<UploadFileLike> | UploadFileLike;

@InputType()
export class SubmitCorrectionPhotoInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   sessionId!: string;

   @Field(() => UploadScalar, { nullable: true })
   photoFile?: UploadReference;

   @Field({ nullable: true })
   @IsOptional()
   @IsString()
   photoBase64?: string;

   @Field(() => Float, { nullable: true, defaultValue: 0.5 })
   @IsOptional()
   @Min(0)
   @Max(1)
   threshold?: number;

   @Field(() => Float, { nullable: true, defaultValue: 0.12 })
   @IsOptional()
   @Min(0)
   @Max(1)
   delta?: number;
}
