import { Resolver } from '@nestjs/graphql';
import { KlassListObject } from '../objects/klass-list.object';

@Resolver(() => KlassListObject)
export class KlassListResolver {}
