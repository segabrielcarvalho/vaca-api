import { Resolver } from '@nestjs/graphql';
import { CourseListObject } from '../objects/course-list.object';
import { CourseFieldsResolver } from './course-fields.resolver';

@Resolver(() => CourseListObject)
export class CourseListResolver extends CourseFieldsResolver {}
