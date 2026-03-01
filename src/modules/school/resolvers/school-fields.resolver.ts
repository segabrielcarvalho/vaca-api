import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { School } from '../../graphql/@generated/school/school.model';
import { GetUrlService } from '../../storage/services/get-url.service';

@Resolver(() => School)
export class SchoolFieldsResolver {
   constructor(private readonly getUrlService: GetUrlService) {}

   @ResolveField('bannerPath', () => String, { nullable: true })
   async resolveBannerPath(
      @Parent() school: { bannerPath?: string | null },
   ): Promise<string | null> {
      return this.toSignedUrl(school.bannerPath);
   }

   @ResolveField('logoFullPath', () => String, { nullable: true })
   async resolveLogoFullPath(
      @Parent() school: { logoFullPath?: string | null },
   ): Promise<string | null> {
      return this.toSignedUrl(school.logoFullPath);
   }

   @ResolveField('logoMarkPath', () => String, { nullable: true })
   async resolveLogoMarkPath(
      @Parent() school: { logoMarkPath?: string | null },
   ): Promise<string | null> {
      return this.toSignedUrl(school.logoMarkPath);
   }

   @ResolveField('faviconPath', () => String, { nullable: true })
   async resolveFaviconPath(
      @Parent() school: { faviconPath?: string | null },
   ): Promise<string | null> {
      return this.toSignedUrl(school.faviconPath);
   }

   private async toSignedUrl(
      path: string | null | undefined,
   ): Promise<string | null> {
      if (!path) {
         return null;
      }

      try {
         return await this.getUrlService.run(path);
      } catch {
         return null;
      }
   }
}
