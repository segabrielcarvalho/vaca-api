import { Resolver } from '@nestjs/graphql';
import { KlassListObject } from '../objects/klass-list.object';
import { KlassFieldsResolver } from './klass-fields.resolver';

@Resolver(() => KlassListObject)
export class KlassListResolver extends KlassFieldsResolver {}
