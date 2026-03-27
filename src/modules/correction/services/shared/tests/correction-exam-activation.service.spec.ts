import { CorrectionExamActivationService } from '../correction-exam-activation.service';

describe('CorrectionExamActivationService', () => {
   let service: CorrectionExamActivationService;
   let tx: {
      correctionExam: {
         aggregate: jest.Mock;
         findMany: jest.Mock;
         create: jest.Mock;
         update: jest.Mock;
         delete: jest.Mock;
         deleteMany: jest.Mock;
      };
      correctionSessionEvent: {
         deleteMany: jest.Mock;
      };
      correctionCapture: {
         deleteMany: jest.Mock;
      };
   };

   beforeEach(() => {
      service = new CorrectionExamActivationService();
      tx = {
         correctionExam: {
            aggregate: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
         },
         correctionSessionEvent: {
            deleteMany: jest.fn(),
         },
         correctionCapture: {
            deleteMany: jest.fn(),
         },
      };
   });

   it('cria uma nova tentativa e apaga por completo as anteriores do mesmo aluno e prova', async () => {
      tx.correctionExam.aggregate.mockResolvedValue({
         _max: { attempt: 1 },
      });
      tx.correctionExam.findMany.mockResolvedValue([
         {
            id: 'correction-1',
            Capture: {
               id: 'capture-1',
               sessionId: 'session-1',
               originalImagePath: 'captures/original-1.jpg',
               rectifiedImagePath: 'captures/rectified-1.jpg',
               overlayImagePath: 'captures/overlay-1.jpg',
            },
         },
      ]);
      tx.correctionExam.create.mockResolvedValue({
         id: 'correction-2',
         attempt: 2,
         isActive: true,
      });

      await expect(
         service.createLatestActiveCorrection(tx as any, {
            examId: 'exam-1',
            studentId: 'student-1',
            filePath: 'captures/final.jpg',
            score: 8,
            status: 'graded',
            gradedByAgentId: 'agent-1',
            metadata: { source: 'omr_v2' },
         }),
      ).resolves.toMatchObject({
         correction: {
            id: 'correction-2',
            attempt: 2,
            isActive: true,
         },
         replacedSessionIds: ['session-1'],
         replacedCaptureArtifacts: [
            {
               correctionExamId: 'correction-1',
               captureId: 'capture-1',
               sessionId: 'session-1',
               originalImagePath: 'captures/original-1.jpg',
               rectifiedImagePath: 'captures/rectified-1.jpg',
               overlayImagePath: 'captures/overlay-1.jpg',
            },
         ],
      });

      expect(tx.correctionExam.findMany).toHaveBeenCalledWith({
         where: {
            examId: 'exam-1',
            studentId: 'student-1',
         },
         select: {
            id: true,
            Capture: {
               select: {
                  id: true,
                  sessionId: true,
                  originalImagePath: true,
                  rectifiedImagePath: true,
                  overlayImagePath: true,
               },
            },
         },
      });
      expect(tx.correctionSessionEvent.deleteMany).toHaveBeenCalledWith({
         where: {
            captureId: {
               in: ['capture-1'],
            },
         },
      });
      expect(tx.correctionCapture.deleteMany).toHaveBeenCalledWith({
         where: {
            id: {
               in: ['capture-1'],
            },
         },
      });
      expect(tx.correctionExam.deleteMany).toHaveBeenCalledWith({
         where: {
            id: {
               in: ['correction-1'],
            },
         },
      });
      expect(tx.correctionExam.create).toHaveBeenCalledWith({
         data: {
            examId: 'exam-1',
            studentId: 'student-1',
            filePath: 'captures/final.jpg',
            attempt: 2,
            score: 8,
            status: 'graded',
            gradedByAgentId: 'agent-1',
            metadata: { source: 'omr_v2' },
            isActive: true,
         },
      });
   });

   it('atualiza a correção atual e apaga outras tentativas do aluno alvo', async () => {
      tx.correctionExam.findMany.mockResolvedValue([
         {
            id: 'correction-1',
            Capture: {
               id: 'capture-1',
               sessionId: 'session-1',
               originalImagePath: 'captures/original-1.jpg',
               rectifiedImagePath: null,
               overlayImagePath: 'captures/overlay-1.jpg',
            },
         },
      ]);
      tx.correctionExam.update.mockResolvedValue({
         id: 'correction-2',
         studentId: 'student-2',
         isActive: true,
      });

      await expect(
         service.updateLatestActiveCorrection(tx as any, {
            correctionExamId: 'correction-2',
            examId: 'exam-1',
            studentId: 'student-2',
            filePath: 'captures/review.jpg',
            score: 10,
            status: 'graded',
            gradedByAgentId: 'agent-2',
            metadata: { source: 'manual_review' },
         }),
      ).resolves.toMatchObject({
         correction: {
            id: 'correction-2',
            studentId: 'student-2',
            isActive: true,
         },
         replacedSessionIds: ['session-1'],
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
      });

      expect(tx.correctionExam.findMany).toHaveBeenCalledWith({
         where: {
            examId: 'exam-1',
            studentId: 'student-2',
            id: {
               not: 'correction-2',
            },
         },
         select: {
            id: true,
            Capture: {
               select: {
                  id: true,
                  sessionId: true,
                  originalImagePath: true,
                  rectifiedImagePath: true,
                  overlayImagePath: true,
               },
            },
         },
      });
      expect(tx.correctionExam.update).toHaveBeenCalledWith({
         where: { id: 'correction-2' },
         data: {
            studentId: 'student-2',
            filePath: 'captures/review.jpg',
            score: 10,
            status: 'graded',
            gradedByAgentId: 'agent-2',
            metadata: { source: 'manual_review' },
            isActive: true,
         },
      });
   });

   it('remove o resultado da correção ao invalidar', async () => {
      tx.correctionExam.delete.mockResolvedValue({
         id: 'correction-3',
      });

      await expect(
         service.deleteCorrectionResult(tx as any, 'correction-3'),
      ).resolves.toMatchObject({
         id: 'correction-3',
      });

      expect(tx.correctionExam.delete).toHaveBeenCalledWith({
         where: { id: 'correction-3' },
      });
   });
});
