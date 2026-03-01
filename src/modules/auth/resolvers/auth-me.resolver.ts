import { Query, Resolver } from '@nestjs/graphql';
import { User } from '../../graphql/@generated/user/user.model';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthMe } from '../objects';
import { MeService } from '../services/account/me.service';
import type { AuthCurrentUser } from '../services/auth-context.service';

@Resolver(() => AuthMe)
export class AuthMeResolver {
   constructor(private readonly meService: MeService) {}

   @Query(() => AuthMe)
   async me(@CurrentUser() user: AuthCurrentUser): Promise<User> {
      return this.meService.run(user);
   }
}
