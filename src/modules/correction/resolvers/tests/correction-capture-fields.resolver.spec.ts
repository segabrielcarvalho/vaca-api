import { CorrectionCaptureFieldsResolver } from '../correction-capture-fields.resolver';

describe('CorrectionCaptureFieldsResolver', () => {
   let getUrlService: {
      run: jest.Mock;
   };
   let resolver: CorrectionCaptureFieldsResolver;

   beforeEach(() => {
      getUrlService = {
         run: jest.fn(),
      };

      resolver = new CorrectionCaptureFieldsResolver(getUrlService as any);
   });

   it('deve reutilizar a URL quando o caminho ja vier absoluto', async () => {
      const path = 'https://cdn.example.com/capture.jpg';

      await expect(
         resolver.resolveOriginalImagePath({
            originalImagePath: path,
         }),
      ).resolves.toBe(path);

      expect(getUrlService.run).not.toHaveBeenCalled();
   });

   it('deve assinar caminhos relativos para os artefatos da captura', async () => {
      getUrlService.run.mockResolvedValue('https://signed.example.com/capture.jpg');

      await expect(
         resolver.resolveOverlayImagePath({
            overlayImagePath: 'captures/overlay.jpg',
         }),
      ).resolves.toBe('https://signed.example.com/capture.jpg');

      expect(getUrlService.run).toHaveBeenCalledWith('captures/overlay.jpg', 600, true);
   });

   it('deve retornar null para caminhos vazios ou ausentes', async () => {
      await expect(
         resolver.resolveRectifiedImagePath({
            rectifiedImagePath: '   ',
         }),
      ).resolves.toBeNull();

      await expect(
         resolver.resolveRectifiedImagePath({
            rectifiedImagePath: null,
         }),
      ).resolves.toBeNull();

      expect(getUrlService.run).not.toHaveBeenCalled();
   });
});
