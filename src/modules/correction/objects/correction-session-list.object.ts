import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { CorrectionSession } from '../../graphql/@generated/correction-session/correction-session.model';
import { DefaultListObject } from '../../graphql/objects/default-list-object';

@ObjectType()
export class CorrectionSessionListObject extends DefaultListObject {
   @Field(() => [CorrectionSession])
   @Type(() => CorrectionSession)
   rows!: CorrectionSession[];
}
