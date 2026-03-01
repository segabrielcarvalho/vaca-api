import { Field, ObjectType } from '@nestjs/graphql';
import { AclScopeType as PrismaAclScopeType } from '../../../../.prisma/client';
import { Type } from 'class-transformer';
import { AclScopeType as GqlAclScopeType } from '../../graphql/@generated/prisma/acl-scope-type.enum';

@ObjectType()
export class SchoolMemberPermissionObject {
   @Field()
   id!: string;

   @Field(() => GqlAclScopeType)
   scopeType!: PrismaAclScopeType;

   @Field()
   scopeId!: string;

   @Field()
   scopeName!: string;

   @Field()
   roleCode!: string;

   @Field()
   roleRank!: number;

   @Field(() => Date)
   createdAt!: Date;

   @Field(() => Date)
   updatedAt!: Date;

   @Field(() => [String])
   @Type(() => String)
   effectivePermissionCodes!: string[];
}
