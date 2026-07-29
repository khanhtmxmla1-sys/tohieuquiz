CREATE TABLE IF NOT EXISTS live_exam_answer_snapshots (
  live_exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  attempt_version INTEGER NOT NULL DEFAULT 0,
  answers TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (live_exam_id, student_id),
  UNIQUE (live_exam_id, student_id, idempotency_key),
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS live_exam_connection_events (
  id TEXT PRIMARY KEY,
  live_exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('online', 'reconnecting', 'offline', 'autosave', 'reconnected')),
  attempt_version INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_exam_connection_events_session_created
  ON live_exam_connection_events(live_exam_id, created_at DESC);
