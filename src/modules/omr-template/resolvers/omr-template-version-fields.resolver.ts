import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { OmrTemplateVersion } from '../../graphql/@generated/omr-template-version/omr-template-version.model';
import { GetUrlService } from '../../storage/services/get-url.service';

@Resolver(() => OmrTemplateVersion)
export class OmrTemplateVersionFieldsResolver {
   constructor(private readonly getUrlService: GetUrlService) {}

   @ResolveField('pdfPath', () => String, { nullable: true })
   async resolvePdfPath(
      @Parent() version: { pdfPath?: string | null },
   ): Promise<string | null> {
      return this.toSignedUrl(version.pdfPath, false);
   }

   @ResolveField('previewImagePath', () => String, { nullable: true })
   async resolvePreviewImagePath(
      @Parent() version: { previewImagePath?: string | null },
   ): Promise<string | null> {
      return this.toSignedUrl(version.previewImagePath, true);
   }

   private normalizePath(path: string | null | undefined): string | null {
      if (!path || typeof path !== 'string') {
         return null;
      }

      const normalized = path.trim();
      return normalized.length > 0 ? normalized : null;
   }

   private async toSignedUrl(
      path: string | null | undefined,
      inline: boolean,
   ): Promise<string | null> {
      const normalizedPath = this.normalizePath(path);
      if (!normalizedPath) {
         return null;
      }

      if (/^https?:\/\//i.test(normalizedPath)) {
         return normalizedPath;
      }

      try {
         return await this.getUrlService.run(normalizedPath, 600, inline);
      } catch {
         return null;
      }
   }
}
