-- Normalize removed QR review reasons before enum replacement.
UPDATE "CorrectionCapture"
SET "reviewReasons" = (
  SELECT COALESCE(
    ARRAY_AGG(
      CASE
        WHEN reason::text IN ('qr_missing', 'qr_invalid', 'qr_signature_invalid')
          THEN 'manual_review'
        ELSE reason::text
      END
    ),
    ARRAY[]::text[]
  )::"CorrectionCaptureReviewReason"[]
  FROM UNNEST("reviewReasons") AS reason
)
WHERE "reviewReasons" && ARRAY[
  'qr_missing'::"CorrectionCaptureReviewReason",
  'qr_invalid'::"CorrectionCaptureReviewReason",
  'qr_signature_invalid'::"CorrectionCaptureReviewReason"
];

-- Remove QR-specific columns.
ALTER TABLE "CorrectionSession"
  DROP COLUMN "qrInvalidCaptures",
  DROP COLUMN "qrInvalidRate";

ALTER TABLE "OmrTemplateVersionPdfAsset"
  DROP COLUMN "qrPayloadJson";

-- Replace enum to remove QR-specific values.
CREATE TYPE "CorrectionCaptureReviewReason_new" AS ENUM (
  'registration_invalid',
  'registration_ambiguous',
  'answer_ambiguous',
  'omr_error',
  'manual_review'
);

ALTER TABLE "CorrectionCapture"
ALTER COLUMN "reviewReasons"
TYPE "CorrectionCaptureReviewReason_new"[]
USING ("reviewReasons"::text[]::"CorrectionCaptureReviewReason_new"[]);

ALTER TYPE "CorrectionCaptureReviewReason" RENAME TO "CorrectionCaptureReviewReason_old";
ALTER TYPE "CorrectionCaptureReviewReason_new" RENAME TO "CorrectionCaptureReviewReason";
DROP TYPE "CorrectionCaptureReviewReason_old";
