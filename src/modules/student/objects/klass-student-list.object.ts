import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { DefaultListObject } from '../../graphql/objects/default-list-object';
import { KlassStudentObject } from './klass-student.object';

@ObjectType()
export class KlassStudentListObject extends DefaultListObject {
   @Field(() => [KlassStudentObject])
   @Type(() => KlassStudentObject)
   rows!: KlassStudentObject[];
}
