import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { OmrTemplateVersionPdfAsset } from '../../graphql/@generated/omr-template-version-pdf-asset/omr-template-version-pdf-asset.model';
import { GetUrlService } from '../../storage/services/get-url.service';

@Resolver(() => OmrTemplateVersionPdfAsset)
export class OmrTemplateVersionPdfAssetFieldsResolver {
   constructor(private readonly getUrlService: GetUrlService) {}

   @ResolveField('pdfPath', () => String, { nullable: true })
   async resolvePdfPath(
      @Parent() asset: { pdfPath?: string | null },
   ): Promise<string | null> {
      return this.toSignedUrl(asset.pdfPath, false);
   }

   @ResolveField('previewImagePath', () => String, { nullable: true })
   async resolvePreviewImagePath(
      @Parent() asset: { previewImagePath?: string | null },
   ): Promise<string | null> {
      return this.toSignedUrl(asset.previewImagePath, true);
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
