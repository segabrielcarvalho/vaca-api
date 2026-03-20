import { CorrectionEventStageEnum } from '../enums/correction-event-stage.enum';
import { CorrectionOmrProcessor } from './correction-omr.processor';

describe('CorrectionOmrProcessor', () => {
   const originalFetch = global.fetch;
   let logger: {
      setContext: jest.Mock;
      setLogLevels: jest.Mock;
      debug: jest.Mock;
   };

   beforeEach(() => {
      logger = {
         setContext: jest.fn(),
         setLogLevels: jest.fn(),
         debug: jest.fn(),
      };
   });

   afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
   });

   it('deve publicar quantidade de acertos e total de questoes ao corrigir capture', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000);

      const prisma = {
         correctionCapture: {
            findUnique: jest.fn().mockResolvedValue({
               id: 'capture-1',
               createdAt: new Date('2026-03-12T18:00:00.000Z'),
               examId: 'exam-1',
               originalImagePath: 'original/path.jpg',
               Exam: {
                  Klass: {
                     Course: {
                        schoolId: 'school-1',
                     },
                  },
                  TemplateVersion: {
                     compiledGeometryJson: { version: 1 },
                  },
                  Questions: [
                     {
                        id: 'question-1',
                        number: 1,
                        correct: 1,
                        value: 1,
                     },
                     {
                        id: 'question-2',
                        number: 2,
                        correct: 3,
                        value: 2,
                     },
                  ],
               },
            }),
            update: jest.fn().mockResolvedValue(undefined),
         },
         student: {
            findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }),
         },
         correctionExam: {
            count: jest.fn().mockResolvedValue(0),
         },
         $transaction: jest.fn(),
      };

      const tx = {
         correctionExam: {
            create: jest.fn().mockResolvedValue({ id: 'correction-1' }),
         },
         correctionQuestion: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
         },
         correctionCapture: {
            update: jest.fn().mockResolvedValue(undefined),
         },
      };
      prisma.$transaction.mockImplementation(
         async (callback: (client: typeof tx) => Promise<unknown>) =>
            callback(tx),
      );

      const publisher = {
         publish: jest.fn().mockResolvedValue(undefined),
      };
      const metrics = {
         refreshSessionMetrics: jest.fn().mockResolvedValue(undefined),
      };
      const storage = {
         downloadFileAsBuffer: jest
            .fn()
            .mockResolvedValue(Buffer.from('image-bytes')),
         saveFileFromBase64: jest.fn().mockResolvedValue(undefined),
      };

      global.fetch = jest.fn().mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            engineVersion: 'omr-v2',
            registration: {
               value: 'REG-001',
               status: 'ok',
            },
            answers: [
               {
                  question: 1,
                  selected: 1,
                  isAmbiguous: false,
               },
               {
                  question: 2,
                  selected: 2,
                  isAmbiguous: false,
               },
            ],
         }),
      }) as typeof fetch;

      const processor = new CorrectionOmrProcessor(
         prisma as never,
         logger as never,
         publisher as never,
         metrics as never,
         storage as never,
         {
            omrBaseUrl: 'http://omr.local',
            omrRequestTimeoutMs: 1000,
            debugTrace: true,
         } as never,
      );

      await processor.process({
         data: {
            captureId: 'capture-1',
            sessionId: 'session-1',
            threshold: 0.5,
            delta: 0.12,
         },
      } as never);

      expect(publisher.publish).toHaveBeenCalledWith(
         expect.objectContaining({
            stage: CorrectionEventStageEnum.CAPTURE_GRADED,
            captureId: 'capture-1',
            sessionId: 'session-1',
            payload: expect.objectContaining({
               captureId: 'capture-1',
               correctionId: 'correction-1',
               correctAnswersCount: 1,
               questionCount: 2,
               score: 1,
               attempt: 1,
               registrationNumber: 'REG-001',
            }),
         }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
         'http://omr.local/api/v2/omr/process',
         expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
               captureId: 'capture-1',
               sessionId: 'session-1',
               imageBase64: Buffer.from('image-bytes').toString('base64'),
               compiledGeometryJson: { version: 1 },
               threshold: 0.5,
               delta: 0.12,
            }),
         }),
      );
      expect(tx.correctionQuestion.createMany).toHaveBeenCalledWith({
         data: [
            {
               correctionId: 'correction-1',
               questionId: 'question-1',
               selected: 1,
               isCorrect: true,
            },
            {
               correctionId: 'correction-1',
               questionId: 'question-2',
               selected: 2,
               isCorrect: false,
            },
         ],
      });
      expect(logger.setLogLevels).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
         'correction_omr.job_started',
         expect.objectContaining({
            captureId: 'capture-1',
            sessionId: 'session-1',
         }),
      );
      expect(logger.debug).toHaveBeenCalledWith(
         'correction_omr.capture_graded',
         expect.objectContaining({
            captureId: 'capture-1',
            correctionId: 'correction-1',
            correctAnswersCount: 1,
            questionCount: 2,
         }),
      );
   });

   it('nao emite debug quando tracing esta desligado', async () => {
      const prisma = {
         correctionCapture: {
            findUnique: jest.fn().mockResolvedValue(null),
         },
      };
      const processor = new CorrectionOmrProcessor(
         prisma as never,
         logger as never,
         { publish: jest.fn() } as never,
         { refreshSessionMetrics: jest.fn() } as never,
         {
            downloadFileAsBuffer: jest.fn(),
            saveFileFromBase64: jest.fn(),
         } as never,
         {
            omrBaseUrl: 'http://omr.local',
            omrRequestTimeoutMs: 1000,
            debugTrace: false,
         } as never,
      );

      await processor.process({
         id: 'job-1',
         data: {
            captureId: 'capture-1',
            sessionId: 'session-1',
            threshold: 0.5,
            delta: 0.12,
         },
      } as never);

      expect(logger.debug).not.toHaveBeenCalled();
      expect(logger.setLogLevels).not.toHaveBeenCalled();
   });

   it('marca capture como error quando falha ao persistir artefatos apos sucesso do omr', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000);

      const correctionCaptureUpdate = jest.fn().mockResolvedValue(undefined);
      const prisma = {
         correctionCapture: {
            findUnique: jest.fn().mockResolvedValue({
               id: 'capture-1',
               createdAt: new Date('2026-03-12T18:00:00.000Z'),
               examId: 'exam-1',
               originalImagePath: 'original/path.jpg',
               Exam: {
                  Klass: {
                     Course: {
                        schoolId: 'school-1',
                     },
                  },
                  TemplateVersion: {
                     compiledGeometryJson: { version: 1 },
                  },
                  Questions: [
                     {
                        id: 'question-1',
                        number: 1,
                        correct: 1,
                        value: 1,
                     },
                  ],
               },
            }),
            update: correctionCaptureUpdate,
         },
         student: {
            findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }),
         },
         correctionExam: {
            count: jest.fn().mockResolvedValue(0),
         },
         $transaction: jest.fn(),
      };

      const publisher = {
         publish: jest.fn().mockResolvedValue(undefined),
      };
      const metrics = {
         refreshSessionMetrics: jest.fn().mockResolvedValue(undefined),
      };
      const storage = {
         downloadFileAsBuffer: jest
            .fn()
            .mockResolvedValue(Buffer.from('image-bytes')),
         saveFileFromBase64: jest
            .fn()
            .mockRejectedValue(
               new Error('Não foi possível identificar o mime type'),
            ),
      };

      global.fetch = jest.fn().mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            engineVersion: 'omr-v2',
            registration: {
               value: 'REG-001',
               status: 'ok',
            },
            answers: [
               {
                  question: 1,
                  selected: 1,
                  isAmbiguous: false,
               },
            ],
            images: {
               rectifiedBase64:
                  Buffer.from('rectified-image').toString('base64'),
               overlayBase64: Buffer.from('overlay-image').toString('base64'),
            },
         }),
      }) as typeof fetch;

      const processor = new CorrectionOmrProcessor(
         prisma as never,
         logger as never,
         publisher as never,
         metrics as never,
         storage as never,
         {
            omrBaseUrl: 'http://omr.local',
            omrRequestTimeoutMs: 1000,
            debugTrace: true,
         } as never,
      );

      await processor.process({
         data: {
            captureId: 'capture-1',
            sessionId: 'session-1',
            threshold: 0.5,
            delta: 0.12,
         },
      } as never);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(correctionCaptureUpdate).toHaveBeenLastCalledWith({
         where: { id: 'capture-1' },
         data: expect.objectContaining({
            status: 'error',
            errorMessage: 'Falha ao persistir resultado da correção.',
         }),
      });
      expect(publisher.publish).toHaveBeenLastCalledWith(
         expect.objectContaining({
            stage: CorrectionEventStageEnum.CAPTURE_ERROR,
            captureId: 'capture-1',
            sessionId: 'session-1',
            payload: expect.objectContaining({
               captureId: 'capture-1',
               errorMessage: 'Falha ao persistir resultado da correção.',
               stage: 'post_omr_finalize',
            }),
         }),
      );
   });
});
