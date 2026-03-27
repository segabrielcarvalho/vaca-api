import { CorrectionCaptureArtifactCleanupService } from '../correction-capture-artifact-cleanup.service';

describe('CorrectionCaptureArtifactCleanupService', () => {
   let logger: {
      setContext: jest.Mock;
      warn: jest.Mock;
   };
   let storage: {
      deleteFile: jest.Mock;
   };
   let service: CorrectionCaptureArtifactCleanupService;

   beforeEach(() => {
      logger = {
         setContext: jest.fn(),
         warn: jest.fn(),
      };
      storage = {
         deleteFile: jest.fn().mockResolvedValue(undefined),
      };

      service = new CorrectionCaptureArtifactCleanupService(
         logger as never,
         storage as never,
      );
   });

   it('deduplica paths, ignora purged e preserva os paths ativos', async () => {
      await service.cleanupReplacedCaptureArtifacts({
         source: 'correction_omr',
         preservedPaths: ['captures/current-overlay.jpg'],
         replacedCaptureArtifacts: [
            {
               correctionExamId: 'correction-1',
               captureId: 'capture-1',
               sessionId: 'session-1',
               originalImagePath: 'captures/original.jpg',
               rectifiedImagePath: null,
               overlayImagePath: 'captures/current-overlay.jpg',
            },
            {
               correctionExamId: 'correction-2',
               captureId: 'capture-2',
               sessionId: 'session-2',
               originalImagePath: 'captures/original.jpg',
               rectifiedImagePath: 'purged:capture-2',
               overlayImagePath: 'captures/overlay-2.jpg',
            },
         ],
      });

      expect(storage.deleteFile).toHaveBeenCalledTimes(2);
      expect(storage.deleteFile).toHaveBeenNthCalledWith(
         1,
         'captures/original.jpg',
      );
      expect(storage.deleteFile).toHaveBeenNthCalledWith(
         2,
         'captures/overlay-2.jpg',
      );
      expect(logger.warn).not.toHaveBeenCalled();
   });

   it('registra warning e segue quando o delete falha', async () => {
      storage.deleteFile
         .mockResolvedValueOnce(undefined)
         .mockRejectedValueOnce(new Error('boom'));

      await expect(
         service.cleanupReplacedCaptureArtifacts({
            source: 'finalize_correction_capture_review',
            replacedCaptureArtifacts: [
               {
                  correctionExamId: 'correction-1',
                  captureId: 'capture-1',
                  sessionId: 'session-1',
                  originalImagePath: 'captures/original-1.jpg',
                  rectifiedImagePath: null,
                  overlayImagePath: 'captures/overlay-1.jpg',
               },
            ],
         }),
      ).resolves.toBeUndefined();

      expect(logger.warn).toHaveBeenCalledWith(
         'Falha ao remover artefato substituído da correção',
         expect.stringContaining('"path":"captures/overlay-1.jpg"'),
      );
   });
});
