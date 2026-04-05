import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Request } from 'express';
import { User } from '../../graphql/@generated/user/user.model';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ActionResultObject, AuthMe, AuthSessionInfo } from '../objects';
import {
   SubmitMyFeedbackArgs,
   SubmitMySupportTicketArgs,
   UpdateMyProfileArgs,
   UpdateMyProfilePreferencesArgs,
} from '../args';
import {
   MySessionsService,
   SubmitMyFeedbackService,
   SubmitMySupportTicketService,
   UpdateMyProfilePreferencesService,
   UpdateMyProfileService,
} from '../services/account';
import type { AuthCurrentUser } from '../services/auth-context.service';

@Resolver()
export class AuthAccountResolver {
   constructor(
      private readonly mySessionsService: MySessionsService,
      private readonly updateMyProfileService: UpdateMyProfileService,
      private readonly updateMyProfilePreferencesService: UpdateMyProfilePreferencesService,
      private readonly submitMyFeedbackService: SubmitMyFeedbackService,
      private readonly submitMySupportTicketService: SubmitMySupportTicketService,
   ) {}

   @Query(() => [AuthSessionInfo])
   async mySessions(
      @CurrentUser() user: AuthCurrentUser,
   ): Promise<AuthSessionInfo[]> {
      return this.mySessionsService.run(user);
   }

   @Mutation(() => AuthMe)
   async updateMyProfile(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: UpdateMyProfileArgs,
   ): Promise<User> {
      return this.updateMyProfileService.run(user, args.data);
   }

   @Mutation(() => AuthMe)
   async updateMyProfilePreferences(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: UpdateMyProfilePreferencesArgs,
   ): Promise<User> {
      return this.updateMyProfilePreferencesService.run(user, args.data);
   }

   @Mutation(() => ActionResultObject)
   async submitMyFeedback(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: SubmitMyFeedbackArgs,
      @Context() ctx: { req?: Request },
   ): Promise<ActionResultObject> {
      return this.submitMyFeedbackService.run(user, args.data, {
         ip: ctx.req?.ip,
         userAgent: ctx.req?.headers['user-agent'],
      });
   }

   @Mutation(() => ActionResultObject)
   async submitMySupportTicket(
      @CurrentUser() user: AuthCurrentUser,
      @Args() args: SubmitMySupportTicketArgs,
      @Context() ctx: { req?: Request },
   ): Promise<ActionResultObject> {
      return this.submitMySupportTicketService.run(user, args.data, {
         ip: ctx.req?.ip,
         userAgent: ctx.req?.headers['user-agent'],
      });
   }
}
