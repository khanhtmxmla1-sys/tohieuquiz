CREATE TABLE IF NOT EXISTS quiz_drafts (
  id TEXT PRIMARY KEY,
  owner_username TEXT NOT NULL,
  quiz_id TEXT,
  draft_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_quiz_drafts_owner_updated
  ON quiz_drafts(owner_username, updated_at DESC);
