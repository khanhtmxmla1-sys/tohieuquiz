-- Competition V1 Task 14: scoped incidents, Admin-granted retests, and
-- durable reconciliation lineage. Raw Live Exam rows remain immutable inputs.

ALTER TABLE competition_school_exam_incidents ADD COLUMN request_id TEXT;

ALTER TABLE competition_school_exam_retests ADD COLUMN incident_id TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN reason_code TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN reason_text TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN grant_request_id TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN expires_at TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN live_exam_session_id TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN resolution TEXT
  CHECK (resolution IS NULL OR resolution IN ('KEEP_ORIGINAL', 'REPLACE_WITH_RETEST', 'INVALIDATE_RESULT'));

ALTER TABLE competition_school_exam_results ADD COLUMN retest_id TEXT;
ALTER TABLE competition_school_exam_results ADD COLUMN resolution TEXT
  CHECK (resolution IS NULL OR resolution IN ('KEEP_ORIGINAL', 'REPLACE_WITH_RETEST', 'INVALIDATE_RESULT'));
ALTER TABLE competition_school_exam_results ADD COLUMN reconcile_version INTEGER
  CHECK (reconcile_version IS NULL OR reconcile_version > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_incidents_event_request
  ON competition_school_exam_incidents(event_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_retests_incident
  ON competition_school_exam_retests(incident_id)
  WHERE incident_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_retests_grant_request
  ON competition_school_exam_retests(event_id, grant_request_id)
  WHERE grant_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_retests_live_session
  ON competition_school_exam_retests(live_exam_session_id)
  WHERE live_exam_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS competition_school_exam_result_history (
  id TEXT PRIMARY KEY,
  canonical_result_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  original_class_id TEXT NOT NULL,
  live_exam_session_id TEXT NOT NULL,
  live_exam_participant_id TEXT,
  score REAL,
  correct_count INTEGER,
  time_taken INTEGER,
  rank INTEGER,
  result_status TEXT NOT NULL,
  disposition TEXT NOT NULL CHECK (disposition IN ('SUPERSEDED')),
  retest_id TEXT NOT NULL,
  reconcile_version INTEGER NOT NULL CHECK (reconcile_version > 0),
  superseded_at TEXT NOT NULL,
  UNIQUE (canonical_result_id, retest_id),
  FOREIGN KEY (canonical_result_id) REFERENCES competition_school_exam_results(id) ON DELETE RESTRICT,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE RESTRICT,
  FOREIGN KEY (retest_id) REFERENCES competition_school_exam_retests(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_school_exam_result_history_event_student
  ON competition_school_exam_result_history(event_id, student_id, reconcile_version DESC);

CREATE TRIGGER IF NOT EXISTS trg_school_exam_result_delete_forbidden
BEFORE DELETE ON competition_school_exam_results
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_RESULT_DELETE_FORBIDDEN');
END;
