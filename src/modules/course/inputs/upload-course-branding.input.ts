import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import { UploadScalar } from '../../graphql/scalar/upload.scalar';

type UploadFileLike = {
   createReadStream: () => NodeJS.ReadableStream;
};

type UploadReference = Promise<UploadFileLike> | UploadFileLike;

@InputType()
export class UploadCourseBrandingInput {
   @Field()
   @IsString()
   @IsNotEmpty()
   courseId!: string;

   @Field(() => UploadScalar, { nullable: true })
   bannerFile?: UploadReference;

   @Field(() => UploadScalar, { nullable: true })
   logoFullFile?: UploadReference;

   @Field(() => UploadScalar, { nullable: true })
   logoMarkFile?: UploadReference;

   @Field(() => UploadScalar, { nullable: true })
   faviconFile?: UploadReference;
}
