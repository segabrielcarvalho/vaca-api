import { Query, Resolver } from '@nestjs/graphql';
import { UserObject } from '../../user/objects/user.object';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MeService } from '../services/me/me-service/me-service.service';
import { ICurrentUser } from '../types/auth.types';

@Resolver()
export class MeResolver {
   constructor(private readonly meService: MeService) {}

   @Query(() => UserObject)
   async me(@CurrentUser() user: ICurrentUser): Promise<UserObject> {
      return this.meService.run(user);
   }
}
