import { Field, ObjectType } from '@nestjs/graphql';
import { DefaultListObject } from '../../graphql/objects/default-list-object';
import { Course } from '../../graphql/@generated/course/course.model';
import { Type } from 'class-transformer';

@ObjectType()
export class CourseListObject extends DefaultListObject {
   @Field(() => [Course])
   @Type(() => Course)
   rows: Course[];
}
