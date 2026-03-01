import { Resolver } from '@nestjs/graphql';
import { SchoolListObject } from '../objects/school-list.object';
import { SchoolFieldsResolver } from './school-fields.resolver';

@Resolver(() => SchoolListObject)
export class SchoolListResolver extends SchoolFieldsResolver {}
