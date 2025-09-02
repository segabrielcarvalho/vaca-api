import { InputType, PartialType, PickType } from '@nestjs/graphql';
import { UniqueFieldsInput } from '../unique-fields-input';

@InputType()
export class GenericUniqueFieldsInput extends PartialType(
   PickType(UniqueFieldsInput, ['id']),
) {}
