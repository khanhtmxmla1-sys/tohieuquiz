CREATE TABLE IF NOT EXISTS teacher_ai_daily_usage (
  username TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (username, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_ai_daily_usage_date
ON teacher_ai_daily_usage(usage_date);

CREATE TABLE IF NOT EXISTS ai_generation_actions (
  action_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  workflow TEXT NOT NULL CHECK(workflow IN ('QUIZ_CREATE', 'QUESTION_REGENERATE', 'GENERIC')),
  status TEXT NOT NULL CHECK(status IN ('RESERVED', 'SUCCEEDED', 'FAILED', 'EXPIRED')),
  usage_date TEXT NOT NULL,
  upstream_calls INTEGER NOT NULL DEFAULT 0 CHECK(upstream_calls >= 0),
  ocr_calls INTEGER NOT NULL DEFAULT 0 CHECK(ocr_calls >= 0),
  generate_calls INTEGER NOT NULL DEFAULT 0 CHECK(generate_calls >= 0),
  review_calls INTEGER NOT NULL DEFAULT 0 CHECK(review_calls >= 0),
  repair_calls INTEGER NOT NULL DEFAULT 0 CHECK(repair_calls >= 0),
  failure_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_actions_user_date
ON ai_generation_actions(username, usage_date, status);

CREATE INDEX IF NOT EXISTS idx_ai_generation_actions_stale
ON ai_generation_actions(status, updated_at);
