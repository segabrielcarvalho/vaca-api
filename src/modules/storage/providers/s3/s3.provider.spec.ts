describe('S3Provider', () => {
   afterEach(() => {
      jest.resetModules();
      jest.clearAllMocks();
      jest.unmock('../../../../utils/dynamic-import');
      jest.unmock('../../../../utils/getMimeTypeByBase64');
   });

   async function createHarness() {
      jest.resetModules();

      const dynamicImportMock = jest.fn();
      const getMimeTypeByBase64Mock = jest.fn();

      jest.doMock('../../../../utils/dynamic-import', () => ({
         dynamicImport: dynamicImportMock,
      }));
      jest.doMock('../../../../utils/getMimeTypeByBase64', () => ({
         __esModule: true,
         default: getMimeTypeByBase64Mock,
      }));

      const { default: S3Provider } = await import('./s3.provider');
      const provider = new S3Provider({
         bucket: 'bucket',
         region: 'us-east-1',
      });
      const send = jest.fn().mockResolvedValue(undefined);

      (provider as any).beforeEach = jest.fn().mockResolvedValue(undefined);
      (provider as any).client = { send };

      return {
         provider,
         send,
         dynamicImportMock,
         getMimeTypeByBase64Mock,
      };
   }

   it('mantem suporte a data uri', async () => {
      const { provider, send, dynamicImportMock, getMimeTypeByBase64Mock } =
         await createHarness();

      getMimeTypeByBase64Mock.mockReturnValue('image/png');
      dynamicImportMock.mockResolvedValue({
         default: {
            getExtension: jest.fn().mockReturnValue('png'),
         },
      });

      await provider.saveFileFromBase64('data:image/png;base64,Zm9v', 'folder');

      expect(getMimeTypeByBase64Mock).toHaveBeenCalledWith(
         'data:image/png;base64,Zm9v',
      );
      expect(send).toHaveBeenCalledWith(
         expect.objectContaining({
            input: expect.objectContaining({
               Bucket: 'bucket',
               Key: expect.stringMatching(/^folder\/.+\.png$/),
               ContentType: 'image/png',
               Body: Buffer.from('Zm9v', 'base64'),
            }),
         }),
      );
   });

   it('aceita base64 puro inferindo mime type pelo buffer', async () => {
      const { provider, send, dynamicImportMock, getMimeTypeByBase64Mock } =
         await createHarness();

      getMimeTypeByBase64Mock.mockImplementation(() => {
         throw new Error('mime ausente');
      });

      const fileTypeFromBuffer = jest.fn().mockResolvedValue({
         mime: 'image/jpeg',
      });

      dynamicImportMock.mockImplementation(async (modulePath: string) => {
         if (modulePath === 'mime') {
            return {
               default: {
                  getExtension: jest.fn().mockReturnValue('jpeg'),
               },
            };
         }

         if (modulePath === 'file-type') {
            return {
               fileTypeFromBuffer,
            };
         }

         throw new Error(`module path inesperado: ${modulePath}`);
      });

      const rawBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString(
         'base64',
      );

      await provider.saveFileFromBase64(rawBase64, 'folder');

      expect(fileTypeFromBuffer).toHaveBeenCalledWith(
         Buffer.from(rawBase64, 'base64'),
      );
      expect(send).toHaveBeenCalledWith(
         expect.objectContaining({
            input: expect.objectContaining({
               Bucket: 'bucket',
               Key: expect.stringMatching(/^folder\/.+\.jpeg$/),
               ContentType: 'image/jpeg',
               Body: Buffer.from(rawBase64, 'base64'),
            }),
         }),
      );
   });

   it('falha com erro claro para base64 invalido', async () => {
      const { provider, dynamicImportMock, getMimeTypeByBase64Mock } =
         await createHarness();

      getMimeTypeByBase64Mock.mockImplementation(() => {
         throw new Error('mime ausente');
      });
      dynamicImportMock.mockResolvedValue({
         fileTypeFromBuffer: jest.fn(),
      });

      await expect(
         provider.saveFileFromBase64('***base64-invalido***', 'folder'),
      ).rejects.toThrow('Conteúdo base64 inválido.');
   });

   it('mantem o prefixo do bucket quando solicitado para URLs publicas locais', async () => {
      const { provider } = await createHarness();
      jest
         .spyOn(provider, 'getSignedUrl')
         .mockResolvedValue(
            'http://localstack:4566/bucket/folder/file.jpg?signature=123',
         );

      await expect(
         provider.getCdnSignedUrl(
            'folder/file.jpg',
            'localhost:4566',
            600,
            true,
            true,
         ),
      ).resolves.toBe(
         'http://localhost:4566/bucket/folder/file.jpg?signature=123',
      );
   });
});
