import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ScopedAuthorized } from '../../auth/decorators/scoped-authorized.decorator';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { ListAclMembershipsArgs } from '../inputs/list-acl-memberships.args';
import { RemoveAclMembershipInput } from '../inputs/remove-acl-membership.input';
import { UpsertAclMembershipInput } from '../inputs/upsert-acl-membership.input';
import { AclMembershipListObject } from '../objects/acl-membership-list.object';
import { AclMembershipObject } from '../objects/acl-membership.object';
import { AclMembershipService } from '../services/acl-membership.service';

@Resolver()
export class AclMembershipResolver {
   constructor(private readonly aclMembershipService: AclMembershipService) {}

   @Query(() => AclMembershipListObject)
   async listAclMemberships(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: ListAclMembershipsArgs,
   ) {
      return this.aclMembershipService.list(user, args);
   }

   @ScopedAuthorized({
      permissionFromScopeManage: true,
      scopeTypePath: 'input.scopeType',
      scopeIdPath: 'input.scopeId',
   })
   @Mutation(() => AclMembershipObject)
   async upsertAclMembership(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: UpsertAclMembershipInput,
   ) {
      return this.aclMembershipService.upsert(user, input);
   }

   @ScopedAuthorized({
      permissionFromScopeManage: true,
      scopeTypePath: 'input.scopeType',
      scopeIdPath: 'input.scopeId',
   })
   @Mutation(() => AclMembershipObject)
   async removeAclMembership(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: RemoveAclMembershipInput,
   ) {
      return this.aclMembershipService.remove(user, input);
   }
}
