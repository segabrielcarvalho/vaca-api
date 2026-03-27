import { FinalizeCorrectionCaptureReviewService } from './finalize-correction-capture-review.service';
import { CorrectionCaptureReviewOutcomeEnum } from '../../enums/correction-capture-review-outcome.enum';

describe('FinalizeCorrectionCaptureReviewService', () => {
   it('limpa artefatos substituídos após promover a captura revisada como última correção', async () => {
      const access = {
         assertCapturePermission: jest.fn().mockResolvedValue({
            id: 'capture-1',
            Exam: {
               klassId: 'klass-1',
            },
         }),
      };
      const prisma = {
         student: {
            findFirst: jest.fn().mockResolvedValue({
               id: 'student-1',
               registrationNumber: 'REG-001',
            }),
         },
         correctionCapture: {
            findUnique: jest.fn().mockResolvedValue({
               id: 'capture-1',
               examId: 'exam-1',
               sessionId: 'session-1',
               studentId: 'student-1',
               registrationNumber: 'REG-001',
               correctionExamId: 'correction-1',
               status: 'needs_review',
               reviewReasons: [],
               reviewNotes: null,
               originalImagePath: 'current/original.jpg',
               rectifiedImagePath: null,
               overlayImagePath: 'current/overlay.jpg',
               omrPayload: { answers: [1] },
               Exam: {
                  Questions: [
                     {
                        id: 'question-1',
                        number: 1,
                        value: 1,
                        correct: 1,
                     },
                  ],
               },
               CorrectionExam: {
                  id: 'correction-1',
                  Items: [
                     {
                        questionId: 'question-1',
                        selected: 1,
                     },
                  ],
               },
               ReviewOverrides: [],
            }),
            update: jest.fn().mockResolvedValue(undefined),
         },
         $transaction: jest.fn(),
      };
      const tx = {
         correctionQuestion: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
         },
         correctionCapture: {
            update: jest.fn().mockResolvedValue(undefined),
         },
         correctionCaptureReviewAuditLog: {
            create: jest.fn().mockResolvedValue(undefined),
         },
      };
      prisma.$transaction.mockImplementation(
         async (callback: (client: typeof tx) => Promise<unknown>) =>
            callback(tx),
      );

      const scopedAccessService = {
         getAgentIdByUserId: jest.fn().mockResolvedValue('agent-1'),
      };
      const metrics = {
         refreshSessionMetrics: jest.fn().mockResolvedValue(undefined),
      };
      const publisher = {
         publish: jest.fn().mockResolvedValue(undefined),
      };
      const correctionExamActivation = {
         deleteCorrectionResult: jest.fn(),
         createLatestActiveCorrection: jest.fn(),
         updateLatestActiveCorrection: jest.fn().mockResolvedValue({
            correction: {
               id: 'correction-1',
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
      const grading = {
         buildQuestionStates: jest.fn().mockReturnValue([
            {
               questionId: 'question-1',
               selectedAlternatives: [1],
            },
         ]),
         computeGradedResult: jest.fn().mockReturnValue({
            score: 1,
            effectiveQuestionCount: 1,
            effectiveMaxScore: 1,
            correctionItems: [
               {
                  questionId: 'question-1',
                  selected: 1,
                  isCorrect: true,
               },
            ],
         }),
      };
      const getReview = {
         runById: jest.fn().mockResolvedValue({ id: 'capture-1' }),
      };

      const service = new FinalizeCorrectionCaptureReviewService(
         prisma as never,
         access as never,
         scopedAccessService as never,
         metrics as never,
         publisher as never,
         correctionExamActivation as never,
         artifactCleanup as never,
         grading as never,
         getReview as never,
      );

      await expect(
         service.run(
            {
               captureId: 'capture-1',
               studentId: 'student-1',
               outcome: CorrectionCaptureReviewOutcomeEnum.graded,
            },
            {
               id: 'user-1',
            } as never,
         ),
      ).resolves.toEqual({ id: 'capture-1' });

      expect(
         correctionExamActivation.updateLatestActiveCorrection,
      ).toHaveBeenCalledWith(
         tx,
         expect.objectContaining({
            correctionExamId: 'correction-1',
            filePath: 'current/overlay.jpg',
            studentId: 'student-1',
            score: 1,
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
            preservedPaths: ['current/overlay.jpg', null],
            source: 'finalize_correction_capture_review',
         },
      );
      expect(metrics.refreshSessionMetrics).toHaveBeenCalledWith('session-1');
      expect(metrics.refreshSessionMetrics).toHaveBeenCalledWith(
         'session-previous',
      );
   });
});
