CREATE TABLE IF NOT EXISTS ai_tutor_daily_usage (
  username TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student', 'teacher', 'admin')),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username, usage_date)
);

CREATE TABLE IF NOT EXISTS ai_tutor_reservations (
  reservation_key TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  result_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('RESERVED', 'SUCCEEDED', 'FAILED')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_reservations_user_day
  ON ai_tutor_reservations(username, usage_date, status);
