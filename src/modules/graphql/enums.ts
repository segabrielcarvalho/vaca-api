import { registerEnumType } from '@nestjs/graphql';
import { GenderEnum, RoleEnum } from '@prisma/client';

export enum SortOrder {
   asc = 'asc',
   desc = 'desc',
}

registerEnumType(SortOrder, { name: 'SortOrder' });
registerEnumType(RoleEnum, { name: 'RoleEnum' });
registerEnumType(GenderEnum, { name: 'GenderEnum' });
