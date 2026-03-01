import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Course } from '../../graphql/@generated/course/course.model';
import { PrismaService } from '../../prisma/prisma.service';
import { GetUrlService } from '../../storage/services/get-url.service';

@Resolver(() => Course)
export class CourseFieldsResolver {
   constructor(
      private readonly prisma: PrismaService,
      private readonly getUrlService: GetUrlService,
   ) {}

   @ResolveField('bannerPath', () => String, { nullable: true })
   async resolveBannerPath(
      @Parent() course: { bannerPath?: string | null; schoolId: string },
   ): Promise<string | null> {
      return this.resolveCourseAssetUrl(course, 'bannerPath');
   }

   @ResolveField('logoFullPath', () => String, { nullable: true })
   async resolveLogoFullPath(
      @Parent() course: { logoFullPath?: string | null; schoolId: string },
   ): Promise<string | null> {
      return this.resolveCourseAssetUrl(course, 'logoFullPath');
   }

   @ResolveField('logoMarkPath', () => String, { nullable: true })
   async resolveLogoMarkPath(
      @Parent() course: { logoMarkPath?: string | null; schoolId: string },
   ): Promise<string | null> {
      return this.resolveCourseAssetUrl(course, 'logoMarkPath');
   }

   @ResolveField('faviconPath', () => String, { nullable: true })
   async resolveFaviconPath(
      @Parent() course: { faviconPath?: string | null; schoolId: string },
   ): Promise<string | null> {
      return this.resolveCourseAssetUrl(course, 'faviconPath');
   }

   private async resolveCourseAssetUrl(
      course: {
         schoolId: string;
         bannerPath?: string | null;
         logoFullPath?: string | null;
         logoMarkPath?: string | null;
         faviconPath?: string | null;
      },
      key: 'bannerPath' | 'logoFullPath' | 'logoMarkPath' | 'faviconPath',
   ): Promise<string | null> {
      const directPath = this.normalizePath(course[key]);
      if (directPath) {
         return this.toSignedUrl(directPath);
      }

      const schoolBranding = await this.prisma.school.findUnique({
         where: {
            id: course.schoolId,
         },
         select: {
            bannerPath: true,
            logoFullPath: true,
            logoMarkPath: true,
            faviconPath: true,
         },
      });

      const fallbackPath = this.normalizePath(schoolBranding?.[key]);
      if (!fallbackPath) {
         return null;
      }

      return this.toSignedUrl(fallbackPath);
   }

   private normalizePath(value: string | null | undefined): string | null {
      if (typeof value !== 'string') {
         return null;
      }

      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
   }

   private async toSignedUrl(path: string): Promise<string | null> {
      try {
         return await this.getUrlService.run(path);
      } catch {
         return null;
      }
   }
}
