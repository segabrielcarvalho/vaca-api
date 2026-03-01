import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { CorrectionCapture } from '../../graphql/@generated/correction-capture/correction-capture.model';
import { DefaultListObject } from '../../graphql/objects/default-list-object';

@ObjectType()
export class CorrectionCaptureListObject extends DefaultListObject {
   @Field(() => [CorrectionCapture])
   @Type(() => CorrectionCapture)
   rows!: CorrectionCapture[];
}
