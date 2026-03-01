import { Field, ObjectType } from '@nestjs/graphql';
import { DefaultListObject } from '../../graphql/objects/default-list-object';
import { School } from '../../graphql/@generated/school/school.model';
import { Type } from 'class-transformer';

@ObjectType()
export class SchoolListObject extends DefaultListObject {
   @Field(() => [School])
   @Type(() => School)
   rows: School[];
}
