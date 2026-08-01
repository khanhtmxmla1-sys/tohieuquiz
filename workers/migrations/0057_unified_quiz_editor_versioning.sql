-- Unified quiz editor metadata, optimistic locking, and version lineage.
ALTER TABLE quizzes ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE quizzes ADD COLUMN parent_quiz_id TEXT;
ALTER TABLE quizzes ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE quizzes ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE quizzes ADD COLUMN updated_at TEXT;

UPDATE quizzes
SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at),
    source_type = COALESCE(NULLIF(source_type, ''), 'manual'),
    version_number = CASE WHEN version_number < 1 THEN 1 ELSE version_number END,
    revision = CASE WHEN revision < 1 THEN 1 ELSE revision END;

CREATE INDEX IF NOT EXISTS idx_quizzes_parent_version
  ON quizzes(parent_quiz_id, version_number);
CREATE INDEX IF NOT EXISTS idx_quizzes_source_type
  ON quizzes(source_type);
