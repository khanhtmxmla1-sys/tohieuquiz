-- Competition V1 Task 17: retryable asynchronous XLSX export state.
-- The base export table was introduced in 0070. These columns make queue
-- processing recoverable without coupling workbook generation to exam requests.

ALTER TABLE competition_school_exam_exports ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0
  CHECK (attempt_count >= 0);
ALTER TABLE competition_school_exam_exports ADD COLUMN processing_started_at TEXT;
ALTER TABLE competition_school_exam_exports ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_school_exam_exports_processing
  ON competition_school_exam_exports(status, processing_started_at, requested_at);
