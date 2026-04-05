import { NotFoundException } from '@nestjs/common';
import {
   CorrectionCaptureQuestionGradingOverride as PrismaCorrectionCaptureQuestionGradingOverride,
   CorrectionCaptureStatus,
   CorrectionCaptureReviewReason,
} from '../../../../../.prisma/client';
import { GetCorrectionCaptureReviewService } from './get-correction-capture-review.service';

describe('GetCorrectionCaptureReviewService', () => {
   let access: { assertCapturePermission: jest.Mock };
   let prisma: {
      correctionCapture: {
         findUnique: jest.Mock;
      };
      correctionExam: {
         findFirst: jest.Mock;
      };
   };
   let getUrlService: { run: jest.Mock };
   let grading: { buildQuestionStates: jest.Mock };
   let service: GetCorrectionCaptureReviewService;

   beforeEach(() => {
      access = {
         assertCapturePermission: jest.fn(),
      };
      prisma = {
         correctionCapture: {
            findUnique: jest.fn(),
         },
         correctionExam: {
            findFirst: jest.fn(),
         },
      };
      getUrlService = {
         run: jest.fn(),
      };
      grading = {
         buildQuestionStates: jest.fn().mockReturnValue([
            {
               questionId: 'question-1',
               number: 1,
               value: 1,
               correctAlternative: 2,
               omrSelectedAlternatives: [2],
               currentSelectedAlternatives: [2],
               gradingOverride: 'auto',
               isCurrentCorrect: true,
               reason: null,
               note: null,
            },
         ]),
      };

      service = new GetCorrectionCaptureReviewService(
         access as never,
         prisma as never,
         getUrlService as never,
         grading as never,
      );
   });

   it('assina o overlay quando ele existir', async () => {
      prisma.correctionCapture.findUnique.mockResolvedValue(
         createCapture({
            originalImagePath: 'original/file.jpg',
            overlayImagePath: 'overlay/file.jpg',
         }),
      );
      getUrlService.run.mockResolvedValue(
         'http://localhost:4566/ad-fusion/overlay/file.jpg',
      );

      const result = await service.runById('capture-1');

      expect(getUrlService.run).toHaveBeenCalledWith(
         'overlay/file.jpg',
         600,
         true,
      );
      expect(result.previewImageUrl).toBe(
         'http://localhost:4566/ad-fusion/overlay/file.jpg',
      );
   });

   it('faz fallback para a imagem original quando nao houver overlay', async () => {
      prisma.correctionCapture.findUnique.mockResolvedValue(
         createCapture({
            originalImagePath: 'original/file.jpg',
            overlayImagePath: null,
         }),
      );
      getUrlService.run.mockResolvedValue(
         'http://localhost:4566/ad-fusion/original/file.jpg',
      );

      const result = await service.runById('capture-1');

      expect(getUrlService.run).toHaveBeenCalledWith(
         'original/file.jpg',
         600,
         true,
      );
      expect(result.previewImageUrl).toBe(
         'http://localhost:4566/ad-fusion/original/file.jpg',
      );
   });

   it('reutiliza URL absoluta sem tentar assinar novamente', async () => {
      prisma.correctionCapture.findUnique.mockResolvedValue(
         createCapture({
            originalImagePath: 'https://cdn.example.com/original/file.jpg',
            overlayImagePath: null,
         }),
      );

      const result = await service.runById('capture-1');

      expect(getUrlService.run).not.toHaveBeenCalled();
      expect(result.previewImageUrl).toBe(
         'https://cdn.example.com/original/file.jpg',
      );
   });

   it('falha com not found quando a captura nao existir', async () => {
      prisma.correctionCapture.findUnique.mockResolvedValue(null);

      await expect(service.runById('capture-404')).rejects.toThrow(
         NotFoundException,
      );
   });

   function createCapture(paths: {
      originalImagePath: string | null;
      overlayImagePath: string | null;
   }) {
      return {
         id: 'capture-1',
         sessionId: 'session-1',
         examId: 'exam-1',
         status: CorrectionCaptureStatus.graded,
         reviewReasons: [CorrectionCaptureReviewReason.manual_review],
         reviewNotes: 'review-note',
         errorMessage: null,
         registrationNumber: 'REG-001',
         originalImagePath: paths.originalImagePath,
         overlayImagePath: paths.overlayImagePath,
         omrPayload: { answers: [2] },
         createdAt: new Date('2026-03-27T01:00:00.000Z'),
         updatedAt: new Date('2026-03-27T01:01:00.000Z'),
         Exam: {
            klassId: 'klass-1',
            title: 'Exam 1',
            Questions: [
               {
                  id: 'question-1',
                  number: 1,
                  value: 1,
                  correct: 2,
               },
            ],
         },
         Student: {
            id: 'student-1',
            registrationNumber: 'REG-001',
            User: {
               email: 'alice@example.com',
               Profile: {
                  name: 'Alice',
               },
            },
         },
         CorrectionExam: {
            id: 'correction-1',
            score: 1,
            Items: [
               {
                  questionId: 'question-1',
                  selected: 2,
               },
            ],
         },
         ReviewOverrides: [
            {
               questionId: 'question-1',
               selectedAlternatives: [2],
               gradingOverride:
                  PrismaCorrectionCaptureQuestionGradingOverride.auto,
               reason: null,
               note: null,
            },
         ],
         ReviewAuditLogs: [
            {
               id: 'log-1',
               createdAt: new Date('2026-03-27T01:02:00.000Z'),
               action: 'preview_opened',
               actorAgentId: 'agent-1',
               Actor: {
                  User: {
                     Profile: {
                        name: 'Reviewer',
                     },
                  },
               },
            },
         ],
      };
   }
});
