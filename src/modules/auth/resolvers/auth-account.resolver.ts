import { Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthSessionInfo } from '../objects';
import { MySessionsService } from '../services/account/my-sessions.service';
import type { AuthCurrentUser } from '../services/auth-context.service';

@Resolver()
export class AuthAccountResolver {
   constructor(private readonly mySessionsService: MySessionsService) {}

   @Query(() => [AuthSessionInfo])
   async mySessions(
      @CurrentUser() user: AuthCurrentUser,
   ): Promise<AuthSessionInfo[]> {
      return this.mySessionsService.run(user);
   }
}
