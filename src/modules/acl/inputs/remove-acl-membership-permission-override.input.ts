import { Field, InputType } from '@nestjs/graphql';
import { AclScopeType as PrismaAclScopeType } from '../../../../.prisma/client';
import { AclScopeType as GqlAclScopeType } from '../../graphql/@generated/prisma/acl-scope-type.enum';

@InputType()
export class RemoveAclMembershipPermissionOverrideInput {
   @Field(() => GqlAclScopeType)
   scopeType!: PrismaAclScopeType;

   @Field()
   scopeId!: string;

   @Field()
   agentId!: string;

   @Field()
   permissionCode!: string;
}
