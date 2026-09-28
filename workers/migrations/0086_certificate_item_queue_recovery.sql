ALTER TABLE certificates ADD COLUMN processing_started_at TEXT;
ALTER TABLE certificates ADD COLUMN processing_token TEXT;
ALTER TABLE certificates ADD COLUMN enqueued_at TEXT;

CREATE INDEX IF NOT EXISTS idx_certs_queue_recovery
  ON certificates(status, processing_started_at, enqueued_at, updated_at);
