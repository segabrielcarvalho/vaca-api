import { Field, ObjectType } from '@nestjs/graphql';
import {
   AclMembershipPermissionEffect as PrismaAclMembershipPermissionEffect,
   AclScopeType as PrismaAclScopeType,
} from '../../../../.prisma/client';
import { AclMembershipPermissionEffect as GqlAclMembershipPermissionEffect } from '../../graphql/@generated/prisma/acl-membership-permission-effect.enum';
import { AclScopeType as GqlAclScopeType } from '../../graphql/@generated/prisma/acl-scope-type.enum';

@ObjectType()
export class AclMembershipPermissionOverrideObject {
   @Field()
   id!: string;

   @Field(() => GqlAclScopeType)
   scopeType!: PrismaAclScopeType;

   @Field()
   scopeId!: string;

   @Field()
   scopeName!: string;

   @Field()
   agentId!: string;

   @Field()
   permissionCode!: string;

   @Field(() => GqlAclMembershipPermissionEffect)
   effect!: PrismaAclMembershipPermissionEffect;

   @Field(() => Date)
   createdAt!: Date;

   @Field(() => Date)
   updatedAt!: Date;
}
