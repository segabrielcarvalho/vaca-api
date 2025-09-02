import { InputType, PickType } from '@nestjs/graphql';
import { GenericConnectOneInput } from './generic/generic-connect-one-input';
import { UniqueFieldsInput } from './unique-fields-input';

@InputType()
class ConnectUserIdInputUserId extends PickType(UniqueFieldsInput, [
   'userId',
]) {}

@InputType()
export class ConnectUserIdInput extends GenericConnectOneInput(
   ConnectUserIdInputUserId,
) {}
