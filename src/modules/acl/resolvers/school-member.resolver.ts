import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthCurrentUser } from '../../auth/services/auth-context.service';
import { extractRequestOrigin } from '../../auth/utils/auth-link.util';
import { GetSchoolMemberInput } from '../inputs/get-school-member.input';
import { InviteSchoolMemberInput } from '../inputs/invite-school-member.input';
import { ListAclRolesByScopeInput } from '../inputs/list-acl-roles-by-scope.input';
import { ListSchoolMemberInvitesInput } from '../inputs/list-school-member-invites.input';
import { ListSchoolMembersInput } from '../inputs/list-school-members.input';
import { ResendSchoolMemberInviteInput } from '../inputs/resend-school-member-invite.input';
import { RevokeSchoolMemberInviteInput } from '../inputs/revoke-school-member-invite.input';
import { UpdateSchoolMemberBasicsInput } from '../inputs/update-school-member-basics.input';
import { AclRoleOptionObject } from '../objects/acl-role-option.object';
import { SchoolMemberDetailObject } from '../objects/school-member-detail.object';
import { SchoolMemberInviteListObject } from '../objects/school-member-invite-list.object';
import { SchoolMemberInviteObject } from '../objects/school-member-invite.object';
import { SchoolMemberListObject } from '../objects/school-member-list.object';
import { SchoolMemberObject } from '../objects/school-member.object';
import { SchoolMemberService } from '../services/school-member.service';

@Resolver()
export class SchoolMemberResolver {
   constructor(private readonly schoolMemberService: SchoolMemberService) {}

   @Query(() => SchoolMemberListObject)
   async listSchoolMembers(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: ListSchoolMembersInput,
   ) {
      return this.schoolMemberService.listSchoolMembers(user, input);
   }

   @Query(() => SchoolMemberDetailObject)
   async getSchoolMember(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: GetSchoolMemberInput,
   ) {
      return this.schoolMemberService.getSchoolMember(user, input);
   }

   @Query(() => SchoolMemberInviteListObject)
   async listSchoolMemberInvites(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: ListSchoolMemberInvitesInput,
   ) {
      return this.schoolMemberService.listSchoolMemberInvites(user, input);
   }

   @Query(() => [AclRoleOptionObject])
   async listAclRolesByScope(@Args('input') input: ListAclRolesByScopeInput) {
      return this.schoolMemberService.listAclRolesByScope(input);
   }

   @Mutation(() => SchoolMemberInviteObject)
   async inviteSchoolMember(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: InviteSchoolMemberInput,
      @Context() ctx: { req?: Request },
   ) {
      return this.schoolMemberService.inviteSchoolMember(user, input, {
         requestOrigin: extractRequestOrigin(ctx.req?.headers),
      });
   }

   @Mutation(() => SchoolMemberInviteObject)
   async resendSchoolMemberInvite(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: ResendSchoolMemberInviteInput,
      @Context() ctx: { req?: Request },
   ) {
      return this.schoolMemberService.resendSchoolMemberInvite(user, input, {
         requestOrigin: extractRequestOrigin(ctx.req?.headers),
      });
   }

   @Mutation(() => SchoolMemberInviteObject)
   async revokeSchoolMemberInvite(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: RevokeSchoolMemberInviteInput,
   ) {
      return this.schoolMemberService.revokeSchoolMemberInvite(user, input);
   }

   @Mutation(() => SchoolMemberObject)
   async updateSchoolMemberBasics(
      @CurrentUser() user: AuthCurrentUser,
      @Args('input') input: UpdateSchoolMemberBasicsInput,
   ) {
      return this.schoolMemberService.updateSchoolMemberBasics(user, input);
   }
}
