import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import {
   ActionResultObject,
   InviteAcceptanceStart,
   InviteEmailVerified,
   InviteProfileCompleted,
} from '../objects';
import {
   CompleteInviteProfileArgs,
   ConsumeInviteMagicLinkArgs,
   InviteUserArgs,
   StartInviteAcceptanceArgs,
   VerifyInviteEmailCodeArgs,
} from '../args';
import { CompleteInviteProfileService } from '../services/invite/complete-invite-profile.service';
import { ConsumeInviteMagicLinkService } from '../services/invite/consume-invite-magic-link.service';
import { InviteUserService } from '../services/invite/invite-user.service';
import { StartInviteAcceptanceService } from '../services/invite/start-invite-acceptance.service';
import { VerifyInviteEmailCodeService } from '../services/invite/verify-invite-email-code.service';
import type { AuthCurrentUser } from '../services/auth-context.service';

@Resolver()
export class AuthInviteResolver {
   constructor(
      private readonly inviteUserService: InviteUserService,
      private readonly startInviteAcceptanceService: StartInviteAcceptanceService,
      private readonly verifyInviteEmailCodeService: VerifyInviteEmailCodeService,
      private readonly consumeInviteMagicLinkService: ConsumeInviteMagicLinkService,
      private readonly completeInviteProfileService: CompleteInviteProfileService,
   ) {}

   @Mutation(() => ActionResultObject)
   async inviteUser(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: InviteUserArgs,
   ): Promise<ActionResultObject> {
      return this.inviteUserService.run(user, args.data);
   }

   @Public()
   @Mutation(() => InviteAcceptanceStart)
   async startInviteAcceptance(
      @Args() args: StartInviteAcceptanceArgs,
      @Context() ctx: { req?: Request },
   ): Promise<InviteAcceptanceStart> {
      return this.startInviteAcceptanceService.run(args.data, {
         ip: ctx.req?.ip,
         userAgent: ctx.req?.headers['user-agent'],
      });
   }

   @Public()
   @Mutation(() => InviteEmailVerified)
   async verifyInviteEmailCode(
      @Args() args: VerifyInviteEmailCodeArgs,
   ): Promise<InviteEmailVerified> {
      return this.verifyInviteEmailCodeService.run(args.data);
   }

   @Public()
   @Mutation(() => InviteEmailVerified)
   async consumeInviteMagicLink(
      @Args() args: ConsumeInviteMagicLinkArgs,
   ): Promise<InviteEmailVerified> {
      return this.consumeInviteMagicLinkService.run(args.data);
   }

   @Public()
   @Mutation(() => InviteProfileCompleted)
   async completeInviteProfile(
      @Args() args: CompleteInviteProfileArgs,
   ): Promise<InviteProfileCompleted> {
      return this.completeInviteProfileService.run(args.data);
   }
}
