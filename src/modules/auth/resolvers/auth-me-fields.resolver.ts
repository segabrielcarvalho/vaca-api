import { ResolveField, Resolver, Root } from '@nestjs/graphql';
import { User } from '../../graphql/@generated/user/user.model';
import { UserProfile } from '../../graphql/@generated/user-profile/user-profile.model';
import { PrismaService } from '../../prisma/prisma.service';
import { GetUrlService } from '../../storage/services/get-url.service';
import { AuthMe } from '../objects';

@Resolver(() => AuthMe)
export class AuthMeFieldsResolver {
   constructor(
      private readonly prisma: PrismaService,
      private readonly getUrlService: GetUrlService,
   ) {}

   @ResolveField(() => String, { nullable: true })
   async photoUrl(@Root() user: User): Promise<string | undefined> {
      const profile = await this.prisma.userProfile.findUnique({
         where: { userId: user.id },
      });
      const photoPath = profile?.photoPath ?? undefined;
      if (!photoPath) return undefined;

      try {
         return await this.getUrlService.run(photoPath);
      } catch {
         return undefined;
      }
   }

   @ResolveField(() => UserProfile, { nullable: true })
   async Profile(@Root() user: User): Promise<UserProfile | null> {
      return this.prisma.userProfile.findUnique({
         where: { userId: user.id },
      });
   }
}
