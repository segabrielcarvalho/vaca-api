import { CorrectionEventStageEnum } from '../enums/correction-event-stage.enum';
import { CorrectionOmrProcessor } from './correction-omr.processor';

describe('CorrectionOmrProcessor', () => {
   const originalFetch = global.fetch;
   let logger: {
      setContext: jest.Mock;
      setLogLevels: jest.Mock;
      log: jest.Mock;
      debug: jest.Mock;
   };

   beforeEach(() => {
      logger = {
         setContext: jest.fn(),
         setLogLevels: jest.fn(),
         log: jest.fn(),
         debug: jest.fn(),
      };
   });

   afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
   });

   it('publica quantidade de acertos e total de questões ao corrigir captura', async () => {
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
         $transaction: jest.fn(),
      };
      const tx = {
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
      const correctionExamActivation = {
         createLatestActiveCorrection: jest.fn().mockResolvedValue({
            correction: {
               id: 'correction-1',
               attempt: 1,
            },
            replacedSessionIds: [],
            replacedCaptureArtifacts: [],
         }),
      };
      const artifactCleanup = {
         cleanupReplacedCaptureArtifacts: jest.fn().mockResolvedValue(undefined),
      };
      const metrics = {
         refreshSessionMetrics: jest.fn().mockResolvedValue(undefined),
      };
      const storage = {
         downloadFileAsBuffer: jest
            .fn()
            .mockResolvedValue(Buffer.from('image-bytes')),
         saveFileFromBufferAtKey: jest.fn().mockResolvedValue(undefined),
         deleteFile: jest.fn().mockResolvedValue(undefined),
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
         correctionExamActivation as never,
         artifactCleanup as never,
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

      const omrRequest = JSON.parse(
         (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(omrRequest.masterAnswers).toEqual([1, 3]);

      expect(
         correctionExamActivation.createLatestActiveCorrection,
      ).toHaveBeenCalledWith(
         tx,
         expect.objectContaining({
            examId: 'exam-1',
            studentId: 'student-1',
            score: 1,
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
      expect(metrics.refreshSessionMetrics).toHaveBeenCalledWith('session-1');
      expect(artifactCleanup.cleanupReplacedCaptureArtifacts).toHaveBeenCalledWith(
         expect.objectContaining({
            replacedCaptureArtifacts: [],
            preservedPaths: ['original/path.jpg', undefined],
            source: 'correction_omr',
         }),
      );
      expect(logger.setLogLevels).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
         'correction_omr.capture_graded',
         expect.objectContaining({
            captureId: 'capture-1',
            correctionId: 'correction-1',
         }),
      );
   });

   it('serializa null em masterAnswers quando a alternativa correta não for inteira válida', async () => {
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
                        correct: null,
                        value: 1,
                     },
                  ],
               },
            }),
            update: jest.fn().mockResolvedValue(undefined),
         },
         student: {
            findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }),
         },
         $transaction: jest.fn(),
      };
      const tx = {
         correctionQuestion: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
         },
         correctionCapture: {
            update: jest.fn().mockResolvedValue(undefined),
         },
      };
      prisma.$transaction.mockImplementation(
         async (callback: (client: typeof tx) => Promise<unknown>) =>
            callback(tx),
      );

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
         }),
      }) as typeof fetch;

      const processor = new CorrectionOmrProcessor(
         prisma as never,
         logger as never,
         { publish: jest.fn().mockResolvedValue(undefined) } as never,
         {
            createLatestActiveCorrection: jest.fn().mockResolvedValue({
               correction: {
                  id: 'correction-1',
                  attempt: 1,
               },
               replacedSessionIds: [],
               replacedCaptureArtifacts: [],
            }),
         } as never,
         {
            cleanupReplacedCaptureArtifacts: jest
               .fn()
               .mockResolvedValue(undefined),
         } as never,
         { refreshSessionMetrics: jest.fn().mockResolvedValue(undefined) } as never,
         {
            downloadFileAsBuffer: jest
               .fn()
               .mockResolvedValue(Buffer.from('image-bytes')),
            saveFileFromBufferAtKey: jest.fn().mockResolvedValue(undefined),
            deleteFile: jest.fn().mockResolvedValue(undefined),
         } as never,
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

      const omrRequest = JSON.parse(
         (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(omrRequest.masterAnswers).toEqual([null]);
   });

   it('descarta a captura quando a matrícula não é encontrada', async () => {
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
                  Questions: [],
               },
            }),
            update: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
         },
         correctionSessionEvent: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
         },
         student: {
            findUnique: jest.fn().mockResolvedValue(null),
         },
         $transaction: jest.fn(),
      };
      prisma.$transaction.mockImplementation(
         async (callback: (client: typeof prisma) => Promise<unknown>) =>
            callback(prisma as any),
      );

      const publisher = {
         publish: jest.fn().mockResolvedValue(undefined),
      };
      const metrics = {
         refreshSessionMetrics: jest.fn().mockResolvedValue(undefined),
      };
      const artifactCleanup = {
         cleanupReplacedCaptureArtifacts: jest.fn().mockResolvedValue(undefined),
      };
      const storage = {
         downloadFileAsBuffer: jest
            .fn()
            .mockResolvedValue(Buffer.from('image-bytes')),
         saveFileFromBufferAtKey: jest.fn().mockResolvedValue(undefined),
         deleteFile: jest.fn().mockResolvedValue(undefined),
      };

      global.fetch = jest.fn().mockResolvedValue({
         ok: true,
         json: async () => ({
            success: true,
            engineVersion: 'omr-v2',
            registration: {
               value: 'REG-404',
               status: 'ok',
            },
            answers: [],
         }),
      }) as typeof fetch;

      const processor = new CorrectionOmrProcessor(
         prisma as never,
         logger as never,
         publisher as never,
         { createLatestActiveCorrection: jest.fn() } as never,
         artifactCleanup as never,
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

      expect(prisma.correctionSessionEvent.deleteMany).toHaveBeenCalledWith({
         where: {
            captureId: 'capture-1',
         },
      });
      expect(prisma.correctionCapture.delete).toHaveBeenCalledWith({
         where: {
            id: 'capture-1',
         },
      });
      expect(publisher.publish).not.toHaveBeenCalledWith(
         expect.objectContaining({
            stage: CorrectionEventStageEnum.CAPTURE_NEEDS_REVIEW,
         }),
      );
      expect(publisher.publish).toHaveBeenCalledWith(
         expect.objectContaining({
            sessionId: 'session-1',
            captureId: 'capture-1',
            stage: CorrectionEventStageEnum.CAPTURE_DISCARDED,
            payload: expect.objectContaining({
               captureId: 'capture-1',
               reason: 'registration_student_missing',
            }),
         }),
      );
      expect(metrics.refreshSessionMetrics).toHaveBeenCalledWith('session-1');
      expect(logger.debug).toHaveBeenCalledWith(
         'correction_omr.capture_discarded',
         expect.objectContaining({
            captureId: 'capture-1',
            reason: 'registration_student_missing',
         }),
      );
   });

   it('descarta a captura quando o OMR não consegue ler a folha', async () => {
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
                  Questions: [],
               },
            }),
            update: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn().mockResolvedValue(undefined),
         },
         correctionSessionEvent: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
         },
         student: {
            findUnique: jest.fn(),
         },
         $transaction: jest.fn(),
      };
      prisma.$transaction.mockImplementation(
         async (callback: (client: typeof prisma) => Promise<unknown>) =>
            callback(prisma as any),
      );

      const publisher = {
         publish: jest.fn().mockResolvedValue(undefined),
      };
      const metrics = {
         refreshSessionMetrics: jest.fn().mockResolvedValue(undefined),
      };
      const artifactCleanup = {
         cleanupReplacedCaptureArtifacts: jest.fn().mockResolvedValue(undefined),
      };
      const storage = {
         downloadFileAsBuffer: jest
            .fn()
            .mockResolvedValue(Buffer.from('image-bytes')),
         saveFileFromBufferAtKey: jest.fn().mockResolvedValue(undefined),
         deleteFile: jest.fn().mockResolvedValue(undefined),
      };

      global.fetch = jest.fn().mockResolvedValue({
         ok: true,
         json: async () => ({
            success: false,
            engineVersion: 'omr-v2',
            error: {
               message: 'Nao foi possivel identificar as marcas fiduciais.',
            },
         }),
      }) as typeof fetch;

      const processor = new CorrectionOmrProcessor(
         prisma as never,
         logger as never,
         publisher as never,
         { createLatestActiveCorrection: jest.fn() } as never,
         artifactCleanup as never,
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

      expect(prisma.correctionSessionEvent.deleteMany).toHaveBeenCalledWith({
         where: {
            captureId: 'capture-1',
         },
      });
      expect(prisma.correctionCapture.delete).toHaveBeenCalledWith({
         where: {
            id: 'capture-1',
         },
      });
      expect(publisher.publish).toHaveBeenCalledWith(
         expect.objectContaining({
            sessionId: 'session-1',
            captureId: 'capture-1',
            stage: CorrectionEventStageEnum.CAPTURE_DISCARDED,
            payload: expect.objectContaining({
               captureId: 'capture-1',
               reason: 'omr_unreadable',
               errorMessage:
                  'Nao foi possivel identificar as marcas fiduciais.',
            }),
         }),
      );
      expect(metrics.refreshSessionMetrics).toHaveBeenCalledWith('session-1');
      expect(logger.debug).toHaveBeenCalledWith(
         'correction_omr.capture_discarded',
         expect.objectContaining({
            captureId: 'capture-1',
            reason: 'omr_unreadable',
         }),
      );
   });

   it('não emite debug quando tracing está desligado', async () => {
      const prisma = {
         correctionCapture: {
            findUnique: jest.fn().mockResolvedValue(null),
         },
      };
      const processor = new CorrectionOmrProcessor(
         prisma as never,
         logger as never,
         { publish: jest.fn() } as never,
         { createLatestActiveCorrection: jest.fn() } as never,
         { cleanupReplacedCaptureArtifacts: jest.fn() } as never,
         { refreshSessionMetrics: jest.fn() } as never,
         {
            downloadFileAsBuffer: jest.fn(),
            saveFileFromBufferAtKey: jest.fn(),
            deleteFile: jest.fn(),
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

   it('usa o overlay como filePath ativo e limpa artefatos substituídos', async () => {
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
                  ],
               },
            }),
            update: jest.fn().mockResolvedValue(undefined),
         },
         student: {
            findUnique: jest.fn().mockResolvedValue({ id: 'student-1' }),
         },
         $transaction: jest.fn(),
      };
      const tx = {
         correctionQuestion: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      const correctionExamActivation = {
         createLatestActiveCorrection: jest.fn().mockResolvedValue({
            correction: {
               id: 'correction-1',
               attempt: 2,
            },
            replacedSessionIds: ['session-previous'],
            replacedCaptureArtifacts: [
               {
                  correctionExamId: 'correction-old',
                  captureId: 'capture-old',
                  sessionId: 'session-previous',
                  originalImagePath: 'previous/original.jpg',
                  rectifiedImagePath: null,
                  overlayImagePath: 'previous/overlay.jpg',
               },
            ],
         }),
      };
      const artifactCleanup = {
         cleanupReplacedCaptureArtifacts: jest.fn().mockResolvedValue(undefined),
      };
      const metrics = {
         refreshSessionMetrics: jest.fn().mockResolvedValue(undefined),
      };
      const storage = {
         downloadFileAsBuffer: jest
            .fn()
            .mockResolvedValue(Buffer.from('image-bytes')),
         saveFileFromBufferAtKey: jest.fn().mockResolvedValue(undefined),
         deleteFile: jest.fn().mockResolvedValue(undefined),
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
               overlayBase64:
                  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
            },
         }),
      }) as typeof fetch;

      const processor = new CorrectionOmrProcessor(
         prisma as never,
         logger as never,
         publisher as never,
         correctionExamActivation as never,
         artifactCleanup as never,
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

      expect(
         correctionExamActivation.createLatestActiveCorrection,
      ).toHaveBeenCalledWith(
         tx,
         expect.objectContaining({
            filePath:
               'corrections/sessions/session-1/captures/capture-1/07_overlay_final.jpg',
         }),
      );
      expect(artifactCleanup.cleanupReplacedCaptureArtifacts).toHaveBeenCalledWith(
         {
            replacedCaptureArtifacts: [
               {
                  correctionExamId: 'correction-old',
                  captureId: 'capture-old',
                  sessionId: 'session-previous',
                  originalImagePath: 'previous/original.jpg',
                  rectifiedImagePath: null,
                  overlayImagePath: 'previous/overlay.jpg',
               },
            ],
            preservedPaths: [
               'corrections/sessions/session-1/captures/capture-1/07_overlay_final.jpg',
               undefined,
            ],
            source: 'correction_omr',
         },
      );
   });
});
