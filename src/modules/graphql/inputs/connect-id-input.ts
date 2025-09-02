import { InputType, PickType } from '@nestjs/graphql';
import { GenericConnectOneInput } from './generic/generic-connect-one-input';
import { UniqueFieldsInput } from './unique-fields-input';

@InputType()
class ConnectIdInputId extends PickType(UniqueFieldsInput, ['id']) {}

@InputType()
export class ConnectIdInput extends GenericConnectOneInput(ConnectIdInputId) {}
