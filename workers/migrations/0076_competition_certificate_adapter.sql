-- Competition V1 Task 16: adapt published ranking winners into the existing
-- class-oriented certificate batch engine without creating fake classes.

ALTER TABLE competition_school_exam_certificate_batches ADD COLUMN ranking_version INTEGER
  CHECK (ranking_version IS NULL OR ranking_version > 0);
ALTER TABLE competition_school_exam_certificate_batches ADD COLUMN template_id TEXT;
ALTER TABLE competition_school_exam_certificate_batches ADD COLUMN winner_count INTEGER NOT NULL DEFAULT 0
  CHECK (winner_count >= 0);
ALTER TABLE competition_school_exam_certificate_batches ADD COLUMN error_code TEXT;

CREATE TABLE IF NOT EXISTS competition_school_exam_certificate_batch_items (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  publication_version INTEGER NOT NULL CHECK (publication_version > 0),
  ranking_version INTEGER NOT NULL CHECK (ranking_version > 0),
  original_class_id TEXT NOT NULL,
  certificate_batch_id TEXT NOT NULL,
  winner_count INTEGER NOT NULL CHECK (winner_count > 0),
  created_at TEXT NOT NULL,
  UNIQUE (parent_id, original_class_id),
  UNIQUE (parent_id, certificate_batch_id),
  FOREIGN KEY (parent_id) REFERENCES competition_school_exam_certificate_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (original_class_id) REFERENCES classes(id) ON DELETE RESTRICT,
  FOREIGN KEY (certificate_batch_id) REFERENCES certificate_batches(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_school_exam_certificate_batch_items_event_version
  ON competition_school_exam_certificate_batch_items(event_id, publication_version, ranking_version, original_class_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_certificate_batch_items_batch
  ON competition_school_exam_certificate_batch_items(certificate_batch_id);
