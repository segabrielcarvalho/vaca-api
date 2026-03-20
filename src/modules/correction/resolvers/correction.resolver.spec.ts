import { normalizeCorrectionSessionEventDate } from './correction.resolver';

describe('CorrectionResolver', () => {
   it('normaliza createdAt string recebido via pubsub para Date', () => {
      const payload = normalizeCorrectionSessionEventDate({
         correctionSessionEvents: {
            id: 'event-1',
            createdAt: '2026-03-13T00:08:24.808Z' as never,
            sessionId: 'session-1',
            captureId: 'capture-1',
            stage: 'capture_processing',
            durationMs: null,
            payload: null,
         },
      });

      expect(payload.correctionSessionEvents?.createdAt).toBeInstanceOf(Date);
      expect(payload.correctionSessionEvents?.createdAt.toISOString()).toBe(
         '2026-03-13T00:08:24.808Z',
      );
   });

   it('mantem payload intacto quando createdAt ja e Date', () => {
      const createdAt = new Date('2026-03-13T00:08:24.808Z');
      const payload = {
         correctionSessionEvents: {
            id: 'event-1',
            createdAt,
            sessionId: 'session-1',
            captureId: 'capture-1',
            stage: 'capture_processing',
            durationMs: null,
            payload: null,
         },
      };

      expect(normalizeCorrectionSessionEventDate(payload)).toBe(payload);
   });
});
