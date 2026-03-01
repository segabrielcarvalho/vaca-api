import { Field, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { DefaultListObject } from '../../graphql/objects/default-list-object';
import { AclMembershipPermissionOverrideObject } from './acl-membership-permission-override.object';

@ObjectType()
export class AclMembershipPermissionOverrideListObject extends DefaultListObject {
   @Field(() => [AclMembershipPermissionOverrideObject])
   @Type(() => AclMembershipPermissionOverrideObject)
   rows!: AclMembershipPermissionOverrideObject[];
}

