# OMR Dynamic Contract (Mobile Consumer)

## Scope
This document defines the contract that mobile will consume in a later phase.
Implementation is already available in `vaca-api-v2` (GraphQL) and `vaca-omr` (REST v2).

## GraphQL Operations (api-v2)

### Template and Exam
- Query `listCourseOmrTemplates(input)`
- Query `getOmrTemplate(input)`
- Mutation `createOmrTemplate(input)`
- Mutation `createOmrTemplateVersion(input)`
- Mutation `publishOmrTemplateVersion(input)`
- Mutation `archiveOmrTemplate(input)`
- Query `listKlassExams(input)`
- Query `getExam(input)`
- Mutation `createExam(input)`
- Mutation `updateExam(input)`

### Correction Session
- Mutation `startCorrectionSession(input)`
  - Input: `examId`
  - Output: `CorrectionSession` (`id`, counters, status, timestamps)
- Mutation `submitCorrectionPhoto(input)`
  - Input: `sessionId`, `photoBase64|photoFile`, `threshold?`, `delta?`
  - Output: `CorrectionCapture` with initial `status=queued`
- Mutation `completeCorrectionSession(input)`
  - Input: `sessionId`
  - Output: `CorrectionSession` (`status=completed`, `finishedAt`)
- Query `listCorrectionCaptures(input)`
  - Input: `sessionId`, `skip?`, `take?`
- Query `listExamCorrections(input)`
  - Input: `examId`, `skip?`, `take?`
- Query `listExamCorrectionSessions(input)`
  - Input: `examId`, `skip?`, `take?`
- Mutation `resolveCorrectionCapture(input)`
  - Input: `captureId`, `status` (`graded` or `needs_review`), optional `reviewReason`, `reviewNotes`
- Mutation `requeueCorrectionCapture(input)`
  - Input: `captureId`, optional `threshold`, `delta`
- Subscription `correctionSessionEvents(sessionId: String!)`
  - Stream of progress events for live session UI.

## Correction Event Stages
- `session_started`
- `capture_queued`
- `capture_processing`
- `capture_graded`
- `capture_needs_review`
- `capture_error`
- `capture_requeued`
- `capture_resolved`
- `session_completed`

Each event includes:
- `sessionId`
- `captureId?`
- `stage`
- `durationMs?`
- `payload?` (JSON)

## OMR REST v2 (vaca-omr)

### Health
- `GET /api/v2/health`
- Response includes `engineVersion`.

### Process
- `POST /api/v2/omr/process`
- Body:
  - `imageBase64: string`
  - `compiledGeometryJson: object|string`
  - `threshold?: number` (default `0.50`)
  - `delta?: number` (default `0.12`)
- Response (success):
  - `success: true`
  - `engineVersion`
  - `registration` (`value`, `status`)
  - `answers` (question-by-question with `selected`, `isAmbiguous`, `confidence`)
  - `answers_numeric`
  - `timings`
  - `images.rectifiedBase64`
  - `images.overlayBase64`
- Response (failure):
  - `success: false`
  - `engineVersion`
  - `error.code`
  - `error.message`
  - `timings`

## Assisted Review Rules
- If registration is invalid/ambiguous: do **not** auto-grade.
- If answers are ambiguous: do **not** auto-grade.
- API marks capture as `needs_review` and stores audit artifacts:
  - `originalImagePath`
  - `rectifiedImagePath`
  - `overlayImagePath`

## Security/Validation
- ACL permissions are enforced by scope:
  - `course.template.read`, `course.template.manage`
  - `klass.exam.read`, `klass.exam.manage`
  - `klass.correction.read`, `klass.correction.run`, `klass.correction.review`

## Retention
- Audit artifacts retention defaults to 365 days.
- Cleanup job purges old artifacts and marks `artifactsPurgedAt`.
