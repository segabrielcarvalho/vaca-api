import { ResolveField, Resolver, Root } from '@nestjs/graphql';
import { MenteeObject } from '../../mentee/objects/mentee.object';
import { PrismaService } from '../../prisma/prisma.service';
import { UserObject } from '../objects/user.object';

@Resolver(() => UserObject)
export class UserFieldsResolver {
   constructor(private readonly prisma: PrismaService) {}

   @ResolveField(() => MenteeObject)
   async Mentee(@Root() user: UserObject): Promise<MenteeObject | null> {
      return this.prisma.mentee.findUnique({
         where: { userId: user.id },
      });
   }

   @ResolveField(() => String)
   async avatarUrl(@Root() user: UserObject) {
      return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(user.name)}`;
   }
}
