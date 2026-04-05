import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean } from 'class-validator';

@InputType()
export class UpdateMyProfilePreferencesInput {
   @Field()
   @IsBoolean()
   scannerSoundEnabled!: boolean;

   @Field()
   @IsBoolean()
   scannerVibrationEnabled!: boolean;
}
