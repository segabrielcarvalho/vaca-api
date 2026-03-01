import { Resolver } from '@nestjs/graphql';
import { Klass } from '../../graphql/@generated/klass/klass.model';

@Resolver(() => Klass)
export class KlassFieldsResolver {}
