import { Field, InputType } from '@nestjs/graphql';
import { AclScopeType as PrismaAclScopeType } from '../../../../.prisma/client';
import { AclScopeType as GqlAclScopeType } from '../../graphql/@generated/prisma/acl-scope-type.enum';

@InputType()
export class RemoveAclMembershipInput {
   @Field(() => GqlAclScopeType)
   scopeType!: PrismaAclScopeType;

   @Field()
   scopeId!: string;

   @Field()
   agentId!: string;
}
