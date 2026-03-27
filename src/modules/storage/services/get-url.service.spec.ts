import { StorageEnvironmentEnum } from '../storage.config';
import { GetUrlService } from './get-url.service';

describe('GetUrlService', () => {
   let storageProvider: {
      getSignedUrl: jest.Mock;
      getCdnSignedUrl: jest.Mock;
   };

   beforeEach(() => {
      storageProvider = {
         getSignedUrl: jest.fn(),
         getCdnSignedUrl: jest.fn(),
      };
   });

   it('usa a base publica configurada em ambiente local', async () => {
      storageProvider.getCdnSignedUrl.mockResolvedValue(
         'http://localhost:4566/ad-fusion/file.jpg?signature=123',
      );

      const service = new GetUrlService(
         {
            environment: StorageEnvironmentEnum.Local,
            storage: {
               bucket: 'ad-fusion',
               cloudFrontUrl: 'http://localhost:4566',
               endpoint: 'http://localstack:4566',
            },
         } as never,
         storageProvider as never,
      );

      await expect(service.run('captures/file.jpg', 600, true)).resolves.toBe(
         'http://localhost:4566/ad-fusion/file.jpg?signature=123',
      );

      expect(storageProvider.getCdnSignedUrl).toHaveBeenCalledWith(
         'captures/file.jpg',
         'localhost:4566',
         600,
         true,
         true,
      );
      expect(storageProvider.getSignedUrl).not.toHaveBeenCalled();
   });

   it('mantem o fluxo publico no ambiente cloud', async () => {
      storageProvider.getCdnSignedUrl.mockResolvedValue(
         'https://cdn.example.com/captures/file.jpg?signature=123',
      );

      const service = new GetUrlService(
         {
            environment: StorageEnvironmentEnum.Cloud,
            storage: {
               bucket: 'ad-fusion',
               cloudFrontUrl: 'https://cdn.example.com',
               endpoint: 'https://s3.us-east-1.amazonaws.com',
               region: 'us-east-1',
               credentials: {
                  accessKeyId: 'key',
                  secretAccessKey: 'secret',
               },
            },
         } as never,
         storageProvider as never,
      );

      await expect(service.run('captures/file.jpg')).resolves.toBe(
         'https://cdn.example.com/captures/file.jpg?signature=123',
      );

      expect(storageProvider.getCdnSignedUrl).toHaveBeenCalledWith(
         'captures/file.jpg',
         'cdn.example.com',
         600,
         true,
         false,
      );
      expect(storageProvider.getSignedUrl).not.toHaveBeenCalled();
   });

   it('faz fallback para URL assinada direta quando nao houver base publica', async () => {
      storageProvider.getSignedUrl.mockResolvedValue(
         'http://localstack:4566/ad-fusion/file.jpg?signature=123',
      );

      const service = new GetUrlService(
         {
            environment: StorageEnvironmentEnum.Local,
            storage: {
               bucket: 'ad-fusion',
               cloudFrontUrl: '',
               endpoint: 'http://localstack:4566',
            },
         } as never,
         storageProvider as never,
      );

      await expect(service.run('captures/file.jpg', 120, false)).resolves.toBe(
         'http://localstack:4566/ad-fusion/file.jpg?signature=123',
      );

      expect(storageProvider.getSignedUrl).toHaveBeenCalledWith(
         'captures/file.jpg',
         120,
         false,
      );
      expect(storageProvider.getCdnSignedUrl).not.toHaveBeenCalled();
   });
});
