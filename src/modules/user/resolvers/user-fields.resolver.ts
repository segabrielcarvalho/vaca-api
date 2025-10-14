import { ResolveField, Resolver, Root } from '@nestjs/graphql';
import { PrismaService } from '../../prisma/prisma.service';
import { UserObject } from '../objects/user.object';

@Resolver(() => UserObject)
export class UserFieldsResolver {
   constructor(private readonly prisma: PrismaService) {}

   @ResolveField(() => String)
   async avatarUrl(@Root() user: UserObject) {
      return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(user.name)}`;
   }
}
