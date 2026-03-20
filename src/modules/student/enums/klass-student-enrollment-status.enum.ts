import { registerEnumType } from '@nestjs/graphql';

export enum KlassStudentEnrollmentStatusEnum {
   active = 'active',
   inactive = 'inactive',
   all = 'all',
}

registerEnumType(KlassStudentEnrollmentStatusEnum, {
   name: 'KlassStudentEnrollmentStatusEnum',
});
