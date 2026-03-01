import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { OmrTemplate } from '../../graphql/@generated/omr-template/omr-template.model';
import { DefaultListObject } from '../../graphql/objects/default-list-object';

@ObjectType()
export class OmrTemplateListObject extends DefaultListObject {
   @Field(() => [OmrTemplate])
   @Type(() => OmrTemplate)
   rows!: OmrTemplate[];
}
