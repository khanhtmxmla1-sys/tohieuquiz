-- Task 22: pause/resume, individual extensions, and audited two-step early close.
ALTER TABLE live_exam_sessions ADD COLUMN paused_at TEXT;
ALTER TABLE live_exam_sessions ADD COLUMN total_paused_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE live_exam_participants ADD COLUMN individual_ends_at TEXT;

CREATE TABLE IF NOT EXISTS live_exam_control_confirmations (
  id TEXT PRIMARY KEY,
  live_exam_id TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action = 'end_early'),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_exam_control_confirmations_lookup
  ON live_exam_control_confirmations(live_exam_id, actor_username, action, expires_at);

CREATE TABLE IF NOT EXISTS live_exam_control_audit (
  id TEXT PRIMARY KEY,
  live_exam_id TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  target_participant_id TEXT,
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (target_participant_id) REFERENCES live_exam_participants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_live_exam_control_audit_session_created
  ON live_exam_control_audit(live_exam_id, created_at DESC);
