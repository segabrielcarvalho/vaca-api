import { Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ResolveField, Resolver, Root } from '@nestjs/graphql';
import appConfig from '../../app/app.config';
import { User } from '../../graphql/@generated/user/user.model';
import { UserProfile } from '../../graphql/@generated/user-profile/user-profile.model';
import { PrismaService } from '../../prisma/prisma.service';
import { GetUrlService } from '../../storage/services/get-url.service';
import {
   AuthCurrentSchool,
   AuthLegalLinks,
   AuthMe,
   AuthProfilePreferences,
   AuthSupportInfo,
} from '../objects';
import { getDefaultAppPrefs, parseAppPrefs } from '../utils/auth-crypto.util';

type AuthMeRoot = User & {
   selectedSchoolId?: string;
};

function normalizeWhatsappNumber(value?: string) {
   const normalized = value?.replace(/\D+/g, '') ?? '';
   return normalized;
}

@Resolver(() => AuthMe)
export class AuthMeFieldsResolver {
   constructor(
      private readonly prisma: PrismaService,
      private readonly getUrlService: GetUrlService,
      @Inject(appConfig.KEY)
      private readonly app: ConfigType<typeof appConfig>,
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

   @ResolveField(() => AuthProfilePreferences)
   async preferences(@Root() user: User): Promise<AuthProfilePreferences> {
      const profile = await this.prisma.userProfile.findUnique({
         where: { userId: user.id },
         select: { appPrefsJson: true },
      });

      return parseAppPrefs(profile?.appPrefsJson ?? getDefaultAppPrefs());
   }

   @ResolveField(() => AuthLegalLinks)
   legalLinks(): AuthLegalLinks {
      return {
         termsUrl: this.app.legalTermsUrl || undefined,
         privacyUrl: this.app.legalPrivacyUrl || undefined,
      };
   }

   @ResolveField(() => AuthSupportInfo)
   support(): AuthSupportInfo {
      const emergencyWhatsappNumber = normalizeWhatsappNumber(
         this.app.supportEmergencyWhatsappNumber,
      );

      return {
         emergencyWhatsappNumber,
         emergencyWhatsappUrl: emergencyWhatsappNumber
            ? `https://wa.me/${emergencyWhatsappNumber}`
            : '',
      };
   }

   @ResolveField(() => AuthCurrentSchool, { nullable: true })
   async currentSchool(
      @Root() user: AuthMeRoot,
   ): Promise<AuthCurrentSchool | null> {
      if (!user.selectedSchoolId) {
         return null;
      }

      return this.prisma.school.findUnique({
         where: { id: user.selectedSchoolId },
         select: {
            id: true,
            name: true,
         },
      });
   }
}
