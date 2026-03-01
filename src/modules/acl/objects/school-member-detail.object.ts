import { Field, ObjectType } from '@nestjs/graphql';
import { AclMembershipPermissionOverrideObject } from './acl-membership-permission-override.object';
import { SchoolMemberObject } from './school-member.object';
import { SchoolMemberPermissionObject } from './school-member-permission.object';
import { SchoolMemberScopeOptionObject } from './school-member-scope-option.object';

@ObjectType()
export class SchoolMemberDetailObject {
   @Field(() => SchoolMemberObject)
   member!: SchoolMemberObject;

   @Field(() => [SchoolMemberPermissionObject])
   schoolPermissions!: SchoolMemberPermissionObject[];

   @Field(() => [SchoolMemberPermissionObject])
   coursePermissions!: SchoolMemberPermissionObject[];

   @Field(() => [SchoolMemberPermissionObject])
   klassPermissions!: SchoolMemberPermissionObject[];

   @Field(() => [AclMembershipPermissionOverrideObject])
   schoolPermissionOverrides!: AclMembershipPermissionOverrideObject[];

   @Field(() => [AclMembershipPermissionOverrideObject])
   coursePermissionOverrides!: AclMembershipPermissionOverrideObject[];

   @Field(() => [AclMembershipPermissionOverrideObject])
   klassPermissionOverrides!: AclMembershipPermissionOverrideObject[];

   @Field(() => [SchoolMemberScopeOptionObject])
   availableCourses!: SchoolMemberScopeOptionObject[];

   @Field(() => [SchoolMemberScopeOptionObject])
   availableKlasses!: SchoolMemberScopeOptionObject[];
}
