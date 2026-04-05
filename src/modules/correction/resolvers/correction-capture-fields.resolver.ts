import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { CorrectionCapture } from '../../graphql/@generated/correction-capture/correction-capture.model';
import { GetUrlService } from '../../storage/services/get-url.service';

@Resolver(() => CorrectionCapture)
export class CorrectionCaptureFieldsResolver {
   constructor(private readonly getUrlService: GetUrlService) {}

   @ResolveField('originalImagePath', () => String, { nullable: true })
   async resolveOriginalImagePath(
      @Parent() capture: { originalImagePath?: string | null },
   ): Promise<string | null> {
      return this.toSignedUrl(capture.originalImagePath);
   }

   @ResolveField('overlayImagePath', () => String, { nullable: true })
   async resolveOverlayImagePath(
      @Parent() capture: { overlayImagePath?: string | null },
   ): Promise<string | null> {
      return this.toSignedUrl(capture.overlayImagePath);
   }

   @ResolveField('rectifiedImagePath', () => String, { nullable: true })
   async resolveRectifiedImagePath(
      @Parent() capture: { rectifiedImagePath?: string | null },
   ): Promise<string | null> {
      return this.toSignedUrl(capture.rectifiedImagePath);
   }

   private normalizePath(path: string | null | undefined): string | null {
      if (typeof path !== 'string') {
         return null;
      }

      const normalized = path.trim();
      return normalized.length > 0 ? normalized : null;
   }

   private async toSignedUrl(
      path: string | null | undefined,
   ): Promise<string | null> {
      const normalizedPath = this.normalizePath(path);
      if (!normalizedPath) {
         return null;
      }

      if (/^https?:\/\//i.test(normalizedPath)) {
         return normalizedPath;
      }

      try {
         return await this.getUrlService.run(normalizedPath, 600, true);
      } catch {
         return null;
      }
   }
}
