import { Field, ObjectType } from '@nestjs/graphql';
import { AclScopeType as PrismaAclScopeType } from '../../../../.prisma/client';
import { AclScopeType as GqlAclScopeType } from '../../graphql/@generated/prisma/acl-scope-type.enum';

@ObjectType()
export class AclMembershipObject {
   @Field()
   id!: string;

   @Field(() => GqlAclScopeType)
   scopeType!: PrismaAclScopeType;

   @Field()
   scopeId!: string;

   @Field()
   agentId!: string;

   @Field()
   roleCode!: string;

   @Field()
   roleRank!: number;

   @Field(() => Date)
   createdAt!: Date;

   @Field(() => Date)
   updatedAt!: Date;
}
