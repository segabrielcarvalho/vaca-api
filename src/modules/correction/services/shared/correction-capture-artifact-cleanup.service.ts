import { Inject, Injectable } from '@nestjs/common';
import { MyLogger } from '../../../logger/my-logger.service';
import { STORAGE_PROVIDER } from '../../../storage/providers';
import type IS3Provider from '../../../storage/providers/s3/s3.interface';
import type { ReplacedCorrectionCaptureArtifact } from './correction-exam-activation.service';

type CleanupInput = {
   replacedCaptureArtifacts: ReplacedCorrectionCaptureArtifact[];
   preservedPaths?: Array<string | null | undefined>;
   source: 'correction_omr' | 'finalize_correction_capture_review';
};

@Injectable()
export class CorrectionCaptureArtifactCleanupService {
   constructor(
      private readonly logger: MyLogger,
      @Inject(STORAGE_PROVIDER)
      private readonly storage: IS3Provider,
   ) {}

   async cleanupReplacedCaptureArtifacts(input: CleanupInput): Promise<void> {
      this.logger.setContext(CorrectionCaptureArtifactCleanupService.name);
      const preservedPaths = new Set(
         (input.preservedPaths ?? []).filter((path): path is string =>
            this.isValidPath(path),
         ),
      );
      const artifactRefsByPath = new Map<
         string,
         ReplacedCorrectionCaptureArtifact[]
      >();

      for (const artifact of input.replacedCaptureArtifacts) {
         for (const path of [
            artifact.originalImagePath,
            artifact.rectifiedImagePath,
            artifact.overlayImagePath,
         ]) {
            if (!this.isValidPath(path) || preservedPaths.has(path)) {
               continue;
            }

            const refs = artifactRefsByPath.get(path) ?? [];
            refs.push(artifact);
            artifactRefsByPath.set(path, refs);
         }
      }

      const targetPaths = Array.from(artifactRefsByPath.keys());
      if (targetPaths.length === 0) {
         return;
      }

      const deletionResults = await Promise.allSettled(
         targetPaths.map((path) => this.storage.deleteFile(path)),
      );

      deletionResults.forEach((result, index) => {
         if (result.status === 'fulfilled') {
            return;
         }

         const path = targetPaths[index];
         const refs = artifactRefsByPath.get(path) ?? [];
         this.logger.warn(
            'Falha ao remover artefato substituído da correção',
            JSON.stringify({
               source: input.source,
               path,
               error:
                  result.reason instanceof Error
                     ? result.reason.message
                     : String(result.reason),
               captureIds: Array.from(new Set(refs.map((ref) => ref.captureId))),
               correctionExamIds: Array.from(
                  new Set(refs.map((ref) => ref.correctionExamId)),
               ),
               sessionIds: Array.from(new Set(refs.map((ref) => ref.sessionId))),
            }),
         );
      });
   }

   private isValidPath(path: string | null | undefined): path is string {
      return Boolean(path) && !path.startsWith('purged:');
   }
}
