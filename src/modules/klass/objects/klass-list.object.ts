import { Field, ObjectType } from '@nestjs/graphql';
import { DefaultListObject } from '../../graphql/objects/default-list-object';
import { Klass } from '../../graphql/@generated/klass/klass.model';
import { Type } from 'class-transformer';

@ObjectType()
export class KlassListObject extends DefaultListObject {
   @Field(() => [Klass])
   @Type(() => Klass)
   rows: Klass[];
}
