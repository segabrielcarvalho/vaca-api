import { registerEnumType } from '@nestjs/graphql';

export enum SchoolMemberInviteStatus {
   pending = 'pending',
   expired = 'expired',
   revoked = 'revoked',
   accepted = 'accepted',
}

registerEnumType(SchoolMemberInviteStatus, {
   name: 'SchoolMemberInviteStatus',
});
