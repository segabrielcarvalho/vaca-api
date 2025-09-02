import { InputType, PickType } from '@nestjs/graphql';
import { UniqueFieldsInput } from './unique-fields-input';

@InputType()
export class UniqueFieldIDInput extends PickType(
   UniqueFieldsInput,
   ['id'],
   InputType,
) {}
