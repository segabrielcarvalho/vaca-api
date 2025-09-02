import { InputType, PickType } from '@nestjs/graphql';
import { UniqueFieldIDInput } from './unique-field-id-input';

@InputType()
export class DefaultWhereIdInput extends PickType(
   UniqueFieldIDInput,
   ['id'] as const,
   InputType,
) {}
