CREATE TABLE IF NOT EXISTS teacher_ai_daily_usage (
  username TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (username, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_ai_daily_usage_date
ON teacher_ai_daily_usage(usage_date);
