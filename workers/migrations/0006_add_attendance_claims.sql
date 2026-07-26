-- Daily attendance claims (server-side anti-duplicate)

CREATE TABLE IF NOT EXISTS attendance_claims (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  claim_date TEXT NOT NULL,
  reward_exp INTEGER NOT NULL,
  reward_coins INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_user_date
ON attendance_claims(username, claim_date);

CREATE INDEX IF NOT EXISTS idx_attendance_user_week
ON attendance_claims(username, claim_date DESC);
