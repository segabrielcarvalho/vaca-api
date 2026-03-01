import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ScopedAuthorized } from '../../auth/decorators/scoped-authorized.decorator';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { ListAclMembershipPermissionOverridesInput } from '../inputs/list-acl-membership-permission-overrides.input';
import { ListAssignableAclPermissionsInput } from '../inputs/list-assignable-acl-permissions.input';
import { RemoveAclMembershipPermissionOverrideInput } from '../inputs/remove-acl-membership-permission-override.input';
import { UpsertAclMembershipPermissionOverrideInput } from '../inputs/upsert-acl-membership-permission-override.input';
import { AclMembershipPermissionOverrideListObject } from '../objects/acl-membership-permission-override-list.object';
import { AclMembershipPermissionOverrideObject } from '../objects/acl-membership-permission-override.object';
import { AclPermissionOptionObject } from '../objects/acl-permission-option.object';
import { AclMembershipPermissionOverrideService } from '../services/acl-membership-permission-override.service';

@Resolver()
export class AclMembershipPermissionOverrideResolver {
   constructor(
      private readonly aclMembershipPermissionOverrideService: AclMembershipPermissionOverrideService,
   ) {}

   @Query(() => [AclPermissionOptionObject])
   async listAssignableAclPermissions(
      @Args('input') input: ListAssignableAclPermissionsInput,
   ) {
      return this.aclMembershipPermissionOverrideService.listAssignablePermissions(
         input,
      );
   }

   @ScopedAuthorized({
      permissionFromScopeManage: true,
      scopeTypePath: 'input.scopeType',
      scopeIdPath: 'input.scopeId',
   })
   @Query(() => AclMembershipPermissionOverrideListObject)
   async listAclMembershipPermissionOverrides(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: ListAclMembershipPermissionOverridesInput,
   ) {
      return this.aclMembershipPermissionOverrideService.list(user, input);
   }

   @ScopedAuthorized({
      permissionFromScopeManage: true,
      scopeTypePath: 'input.scopeType',
      scopeIdPath: 'input.scopeId',
   })
   @Mutation(() => AclMembershipPermissionOverrideObject)
   async upsertAclMembershipPermissionOverride(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: UpsertAclMembershipPermissionOverrideInput,
   ) {
      return this.aclMembershipPermissionOverrideService.upsert(user, input);
   }

   @ScopedAuthorized({
      permissionFromScopeManage: true,
      scopeTypePath: 'input.scopeType',
      scopeIdPath: 'input.scopeId',
   })
   @Mutation(() => AclMembershipPermissionOverrideObject)
   async removeAclMembershipPermissionOverride(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: RemoveAclMembershipPermissionOverrideInput,
   ) {
      return this.aclMembershipPermissionOverrideService.remove(user, input);
   }
}

