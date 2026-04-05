import { RoleEnum } from '../../../../../.prisma/client';
import { SubmitCorrectionPhotoService } from './submit-correction-photo.service';

describe('SubmitCorrectionPhotoService', () => {
   let prisma: {
      correctionSession: { findUniqueOrThrow: jest.Mock };
      correctionCapture: { create: jest.Mock };
   };
   let logger: {
      setContext: jest.Mock;
      log: jest.Mock;
      debug: jest.Mock;
   };
   let scopedAccessService: { getAgentIdByUserId: jest.Mock };
   let access: { assertSessionPermission: jest.Mock };
   let publisher: { publish: jest.Mock };
   let metrics: { refreshSessionMetrics: jest.Mock };
   let storage: { saveFileFromBuffer: jest.Mock };
   let correctionQueue: { add: jest.Mock };

   beforeEach(() => {
      prisma = {
         correctionSession: { findUniqueOrThrow: jest.fn() },
         correctionCapture: { create: jest.fn() },
      };
      logger = {
         setContext: jest.fn(),
         log: jest.fn(),
         debug: jest.fn(),
      };
      scopedAccessService = { getAgentIdByUserId: jest.fn() };
      access = { assertSessionPermission: jest.fn() };
      publisher = { publish: jest.fn() };
      metrics = { refreshSessionMetrics: jest.fn() };
      storage = { saveFileFromBuffer: jest.fn() };
      correctionQueue = { add: jest.fn() };
   });

   it('emite apenas um log operacional resumido ao enfileirar a captura', async () => {
      const base64 = Buffer.from('fake-image-bytes').toString('base64');
      const service = createService();

      access.assertSessionPermission.mockResolvedValue({ id: 'session-1' });
      prisma.correctionSession.findUniqueOrThrow.mockResolvedValue({
         id: 'session-1',
         status: 'running',
         examId: 'exam-1',
      });
      scopedAccessService.getAgentIdByUserId.mockResolvedValue('agent-1');
      storage.saveFileFromBuffer.mockResolvedValue(
         'corrections/sessions/file.jpg',
      );
      prisma.correctionCapture.create.mockResolvedValue({
         id: 'capture-1',
         sessionId: 'session-1',
         examId: 'exam-1',
      });
      correctionQueue.add.mockResolvedValue({ id: 'job-1' });
      publisher.publish.mockResolvedValue(undefined);
      metrics.refreshSessionMetrics.mockResolvedValue(undefined);

      await service.run(
         {
            sessionId: 'session-1',
            photoBase64: base64,
         } as any,
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(logger.log).toHaveBeenCalledWith(
         expect.stringContaining('"event":"submit_correction_photo.submitted"'),
      );
      expect(logger.log).toHaveBeenCalledWith(
         expect.stringContaining('"sessionId":"session-1"'),
      );
      expect(logger.log).toHaveBeenCalledWith(
         expect.stringContaining('"captureId":"capture-1"'),
      );
      expect(logger.log).toHaveBeenCalledTimes(1);
      expect(logger.debug).not.toHaveBeenCalled();
      expect(JSON.stringify(logger.log.mock.calls)).not.toContain(base64);
   });

   it('não emite logs de debug durante o submit', async () => {
      const service = createService();

      access.assertSessionPermission.mockResolvedValue({ id: 'session-1' });
      prisma.correctionSession.findUniqueOrThrow.mockResolvedValue({
         id: 'session-1',
         status: 'running',
         examId: 'exam-1',
      });
      scopedAccessService.getAgentIdByUserId.mockResolvedValue('agent-1');
      storage.saveFileFromBuffer.mockResolvedValue(
         'corrections/sessions/file.jpg',
      );
      prisma.correctionCapture.create.mockResolvedValue({
         id: 'capture-1',
         sessionId: 'session-1',
         examId: 'exam-1',
      });
      correctionQueue.add.mockResolvedValue({ id: 'job-1' });
      publisher.publish.mockResolvedValue(undefined);
      metrics.refreshSessionMetrics.mockResolvedValue(undefined);

      await service.run(
         {
            sessionId: 'session-1',
            photoBase64: Buffer.from('fake-image-bytes').toString('base64'),
         } as any,
         { id: 'user-1', role: RoleEnum.user } as any,
      );

      expect(logger.debug).not.toHaveBeenCalled();
   });

   function createService() {
      return new SubmitCorrectionPhotoService(
         prisma as any,
         logger as any,
         scopedAccessService as any,
         access as any,
         publisher as any,
         metrics as any,
         storage as any,
         correctionQueue as any,
      );
   }
});
