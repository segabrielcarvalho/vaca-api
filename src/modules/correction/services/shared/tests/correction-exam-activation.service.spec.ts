import { CorrectionExamActivationService } from '../correction-exam-activation.service';

describe('CorrectionExamActivationService', () => {
   let service: CorrectionExamActivationService;
   let tx: {
      correctionExam: {
         findFirst: jest.Mock;
         findUnique: jest.Mock;
         findMany: jest.Mock;
         create: jest.Mock;
         update: jest.Mock;
         delete: jest.Mock;
         deleteMany: jest.Mock;
      };
      correctionCapture: {
         update: jest.Mock;
         updateMany: jest.Mock;
      };
   };

   beforeEach(() => {
      service = new CorrectionExamActivationService();
      tx = {
         correctionExam: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
         },
         correctionCapture: {
            update: jest.fn(),
            updateMany: jest.fn(),
         },
      };
   });

   it('cria a primeira correção oficial quando ainda não existe resultado para o aluno', async () => {
      tx.correctionExam.findFirst.mockResolvedValue(null);
      tx.correctionExam.create.mockResolvedValue({
         id: 'correction-1',
         examId: 'exam-1',
         studentId: 'student-1',
      });

      await expect(
         service.upsertOfficialCorrection(tx as any, {
            examId: 'exam-1',
            studentId: 'student-1',
            filePath: 'captures/final.jpg',
            score: 8,
            status: 'graded',
            gradedByAgentId: 'agent-1',
            metadata: { source: 'omr_v2' },
            preserveCaptureId: 'capture-1',
         }),
      ).resolves.toMatchObject({
         correction: {
            id: 'correction-1',
            examId: 'exam-1',
            studentId: 'student-1',
         },
         replacedSessionIds: [],
         replacedCaptureArtifacts: [],
      });

      expect(tx.correctionExam.create).toHaveBeenCalledWith({
         data: {
            examId: 'exam-1',
            studentId: 'student-1',
            filePath: 'captures/final.jpg',
            score: 8,
            status: 'graded',
            gradedByAgentId: 'agent-1',
            metadata: { source: 'omr_v2' },
            isActive: true,
         },
      });
      expect(tx.correctionCapture.update).not.toHaveBeenCalled();
   });

   it('atualiza a correção oficial existente e invalida a captura anterior ligada a ela', async () => {
      tx.correctionExam.findFirst.mockResolvedValue({
         id: 'correction-1',
         Capture: {
            id: 'capture-old',
            sessionId: 'session-old',
            originalImagePath: 'captures/original-old.jpg',
            rectifiedImagePath: 'captures/rectified-old.jpg',
            overlayImagePath: 'captures/overlay-old.jpg',
         },
      });
      tx.correctionExam.update.mockResolvedValue({
         id: 'correction-1',
         examId: 'exam-1',
         studentId: 'student-1',
      });

      await expect(
         service.upsertOfficialCorrection(tx as any, {
            examId: 'exam-1',
            studentId: 'student-1',
            filePath: 'captures/new-final.jpg',
            score: 10,
            status: 'graded',
            gradedByAgentId: 'agent-2',
            metadata: { source: 'manual_review' },
            preserveCaptureId: 'capture-new',
         }),
      ).resolves.toMatchObject({
         correction: {
            id: 'correction-1',
         },
         replacedSessionIds: ['session-old'],
         replacedCaptureArtifacts: [
            {
               correctionExamId: 'correction-1',
               captureId: 'capture-old',
               sessionId: 'session-old',
               originalImagePath: 'captures/original-old.jpg',
               rectifiedImagePath: 'captures/rectified-old.jpg',
               overlayImagePath: 'captures/overlay-old.jpg',
            },
         ],
      });

      expect(tx.correctionCapture.update).toHaveBeenCalledWith({
         where: { id: 'capture-old' },
         data: {
            correctionExamId: null,
            status: 'invalidated',
            resolvedAt: expect.any(Date),
            errorMessage: 'Captura substituída por uma correção mais recente.',
         },
      });
      expect(tx.correctionExam.update).toHaveBeenCalledWith({
         where: { id: 'correction-1' },
         data: {
            filePath: 'captures/new-final.jpg',
            score: 10,
            status: 'graded',
            gradedByAgentId: 'agent-2',
            metadata: { source: 'manual_review' },
            isActive: true,
         },
      });
   });

   it('reaproveita a correção atual ao trocar o aluno e remove correções conflitantes do aluno alvo', async () => {
      tx.correctionExam.findUnique.mockResolvedValue({
         id: 'correction-current',
         examId: 'exam-1',
         studentId: 'student-1',
         Capture: {
            id: 'capture-current',
            sessionId: 'session-current',
            originalImagePath: 'captures/current-original.jpg',
            rectifiedImagePath: null,
            overlayImagePath: 'captures/current-overlay.jpg',
         },
      });
      tx.correctionExam.findMany.mockResolvedValue([
         {
            id: 'correction-target',
            Capture: {
               id: 'capture-target',
               sessionId: 'session-target',
               originalImagePath: 'captures/target-original.jpg',
               rectifiedImagePath: null,
               overlayImagePath: 'captures/target-overlay.jpg',
            },
         },
      ]);
      tx.correctionExam.update.mockResolvedValue({
         id: 'correction-current',
         studentId: 'student-2',
      });

      await expect(
         service.upsertOfficialCorrection(tx as any, {
            correctionExamId: 'correction-current',
            examId: 'exam-1',
            studentId: 'student-2',
            filePath: 'captures/review.jpg',
            score: 7,
            status: 'graded',
            metadata: { source: 'manual_review' },
            preserveCaptureId: 'capture-current',
         }),
      ).resolves.toMatchObject({
         correction: {
            id: 'correction-current',
            studentId: 'student-2',
         },
         replacedSessionIds: ['session-target'],
         replacedCaptureArtifacts: [
            expect.objectContaining({
               correctionExamId: 'correction-target',
               captureId: 'capture-target',
            }),
         ],
      });

      expect(tx.correctionCapture.update).toHaveBeenCalledWith({
         where: { id: 'capture-target' },
         data: {
            correctionExamId: null,
            status: 'invalidated',
            resolvedAt: expect.any(Date),
            errorMessage: 'Captura substituída por uma correção mais recente.',
         },
      });
      expect(tx.correctionExam.deleteMany).toHaveBeenCalledWith({
         where: {
            id: {
               in: ['correction-target'],
            },
         },
      });
      expect(tx.correctionExam.update).toHaveBeenCalledWith({
         where: { id: 'correction-current' },
         data: {
            studentId: 'student-2',
            filePath: 'captures/review.jpg',
            score: 7,
            status: 'graded',
            gradedByAgentId: undefined,
            metadata: { source: 'manual_review' },
            isActive: true,
         },
      });
   });

   it('invalida outras capturas pendentes em revisão do mesmo aluno e prova', async () => {
      await service.invalidateOtherPendingReviewCaptures(tx as any, {
         examId: 'exam-1',
         studentId: 'student-1',
         preserveCaptureId: 'capture-keep',
      });

      expect(tx.correctionCapture.updateMany).toHaveBeenCalledWith({
         where: {
            examId: 'exam-1',
            studentId: 'student-1',
            status: 'needs_review',
            id: {
               not: 'capture-keep',
            },
         },
         data: {
            status: 'invalidated',
            correctionExamId: null,
            resolvedAt: expect.any(Date),
            errorMessage: 'Captura substituída por uma revisão mais recente.',
         },
      });
   });

   it('remove o resultado da correção ao invalidar a captura dona do resultado oficial', async () => {
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
