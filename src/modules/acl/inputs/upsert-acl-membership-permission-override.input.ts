import { Field, InputType } from '@nestjs/graphql';
import {
   AclMembershipPermissionEffect as PrismaAclMembershipPermissionEffect,
   AclScopeType as PrismaAclScopeType,
} from '../../../../.prisma/client';
import { AclMembershipPermissionEffect as GqlAclMembershipPermissionEffect } from '../../graphql/@generated/prisma/acl-membership-permission-effect.enum';
import { AclScopeType as GqlAclScopeType } from '../../graphql/@generated/prisma/acl-scope-type.enum';

@InputType()
export class UpsertAclMembershipPermissionOverrideInput {
   @Field(() => GqlAclScopeType)
   scopeType!: PrismaAclScopeType;

   @Field()
   scopeId!: string;

   @Field()
   agentId!: string;

   @Field()
   permissionCode!: string;

   @Field(() => GqlAclMembershipPermissionEffect)
   effect!: PrismaAclMembershipPermissionEffect;
}

