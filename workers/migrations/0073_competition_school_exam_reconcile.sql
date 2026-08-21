-- Competition V1 canonical result reconciliation.
-- Adds monotonic run versions plus durable, per-run issue rows while preserving
-- raw Live Exam sessions/participants as immutable reconciliation inputs.

ALTER TABLE competition_school_exam_reconcile_runs ADD COLUMN version INTEGER;

UPDATE competition_school_exam_reconcile_runs
SET version = (
  SELECT COUNT(*)
  FROM competition_school_exam_reconcile_runs AS prior
  WHERE prior.event_id = competition_school_exam_reconcile_runs.event_id
    AND (
      prior.started_at < competition_school_exam_reconcile_runs.started_at
      OR (
        prior.started_at = competition_school_exam_reconcile_runs.started_at
        AND prior.id <= competition_school_exam_reconcile_runs.id
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_reconcile_event_version
  ON competition_school_exam_reconcile_runs(event_id, version);

CREATE TRIGGER IF NOT EXISTS trg_school_exam_reconcile_version_required
BEFORE INSERT ON competition_school_exam_reconcile_runs
WHEN NEW.version IS NULL OR NEW.version <= 0
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_RECONCILE_VERSION_REQUIRED');
END;

CREATE TABLE IF NOT EXISTS competition_school_exam_reconcile_issues (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  room_id TEXT,
  student_id TEXT,
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'MISSING_PARTICIPANT',
    'MISSING_SUBMISSION',
    'DUPLICATE_RESULT',
    'ROOM_MEMBER_MISMATCH',
    'SCORE_MISSING',
    'RETEST_PENDING',
    'EXAM_NOT_CLOSED'
  )),
  blocking INTEGER NOT NULL DEFAULT 1 CHECK (blocking IN (0, 1)),
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES competition_school_exam_reconcile_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_school_exam_reconcile_issues_run
  ON competition_school_exam_reconcile_issues(run_id, blocking, issue_type, id);
CREATE INDEX IF NOT EXISTS idx_school_exam_reconcile_issues_event
  ON competition_school_exam_reconcile_issues(event_id, issue_type, room_id, student_id);
