import { Field, ObjectType } from '@nestjs/graphql';
import { AclScopeType as PrismaAclScopeType } from '../../../../.prisma/client';
import { AclScopeType as GqlAclScopeType } from '../../graphql/@generated/prisma/acl-scope-type.enum';

@ObjectType()
export class AclRoleOptionObject {
   @Field()
   code!: string;

   @Field()
   rank!: number;

   @Field(() => GqlAclScopeType)
   scopeType!: PrismaAclScopeType;
}
