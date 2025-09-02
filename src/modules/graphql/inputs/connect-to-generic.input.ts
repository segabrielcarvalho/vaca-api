import { InputType } from '@nestjs/graphql';
import { GenericConnectOneInput } from './generic/generic-connect-one-input';
import { UniqueFieldIDInput } from './unique-field-id-input';

@InputType()
export class ConnectToGenericInput extends GenericConnectOneInput(
   UniqueFieldIDInput,
) {}
