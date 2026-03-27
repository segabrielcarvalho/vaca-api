export enum CorrectionEventStageEnum {
   SESSION_STARTED = 'session_started',
   CAPTURE_QUEUED = 'capture_queued',
   CAPTURE_PROCESSING = 'capture_processing',
   CAPTURE_DISCARDED = 'capture_discarded',
   CAPTURE_NEEDS_REVIEW = 'capture_needs_review',
   CAPTURE_GRADED = 'capture_graded',
   CAPTURE_ERROR = 'capture_error',
   CAPTURE_REQUEUED = 'capture_requeued',
   SESSION_COMPLETED = 'session_completed',
   CAPTURE_RESOLVED = 'capture_resolved',
}
