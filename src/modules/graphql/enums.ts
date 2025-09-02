import { registerEnumType } from '@nestjs/graphql';
import {
   GenderEnum,
   LimitTypeEnum,
   MenteeTypeEnum,
   MessageRoleEnum,
   ModelProviderEnum,
   PeriodUnitEnum,
   RoleEnum,
   SessionRoleEnum,
} from '@prisma/client';

export enum SortOrder {
   asc = 'asc',
   desc = 'desc',
}

registerEnumType(SortOrder, { name: 'SortOrder' });
registerEnumType(RoleEnum, { name: 'RoleEnum' });
registerEnumType(GenderEnum, { name: 'GenderEnum' });
registerEnumType(MenteeTypeEnum, { name: 'MenteeTypeEnum' });
registerEnumType(MessageRoleEnum, { name: 'MessageRole' });
registerEnumType(SessionRoleEnum, { name: 'SessionRoleEnum' });
registerEnumType(LimitTypeEnum, { name: 'LimitTypeEnum' });
registerEnumType(PeriodUnitEnum, { name: 'PeriodUnitEnum' });
registerEnumType(ModelProviderEnum, { name: 'ModelProviderEnum' });
