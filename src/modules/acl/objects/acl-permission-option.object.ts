import { Field, ObjectType } from '@nestjs/graphql';
import { AclScopeType as PrismaAclScopeType } from '../../../../.prisma/client';
import { AclScopeType as GqlAclScopeType } from '../../graphql/@generated/prisma/acl-scope-type.enum';

@ObjectType()
export class AclPermissionOptionObject {
   @Field()
   code!: string;

   @Field(() => GqlAclScopeType)
   scopeType!: PrismaAclScopeType;
}

