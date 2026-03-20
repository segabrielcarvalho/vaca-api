import { registerEnumType } from '@nestjs/graphql';

export enum KlassStudentImportRowStatusEnum {
   created = 'created',
   linked = 'linked',
   reactivated = 'reactivated',
   already_active = 'already_active',
   error = 'error',
}

registerEnumType(KlassStudentImportRowStatusEnum, {
   name: 'KlassStudentImportRowStatusEnum',
});
