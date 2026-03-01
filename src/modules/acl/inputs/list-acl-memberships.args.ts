import { ArgsType, Field, Int } from '@nestjs/graphql';
import { AclScopeType as PrismaAclScopeType } from '../../../../.prisma/client';
import { AclScopeType as GqlAclScopeType } from '../../graphql/@generated/prisma/acl-scope-type.enum';

@ArgsType()
export class ListAclMembershipsArgs {
   @Field(() => GqlAclScopeType)
   scopeType!: PrismaAclScopeType;

   @Field()
   scopeId!: string;

   @Field(() => Int, { nullable: true })
   take?: number;

   @Field(() => Int, { nullable: true })
   skip?: number;
}
