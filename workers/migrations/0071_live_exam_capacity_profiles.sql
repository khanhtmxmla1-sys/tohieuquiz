-- Competition V1 certified Live Exam capacity profiles.
-- Only benchmark runs that satisfy every certification gate may be persisted.
CREATE TABLE IF NOT EXISTS live_exam_capacity_profiles (
  id TEXT PRIMARY KEY,
  benchmark_run_id TEXT NOT NULL UNIQUE,
  build_sha TEXT NOT NULL,
  runtime_config_version TEXT NOT NULL,
  polling_profile_version TEXT NOT NULL,
  certified_concurrent_students INTEGER NOT NULL CHECK (certified_concurrent_students > 0),
  status_p95_ms REAL NOT NULL CHECK (status_p95_ms >= 0 AND status_p95_ms < 500),
  submit_p95_ms REAL NOT NULL CHECK (submit_p95_ms >= 0 AND submit_p95_ms < 2000),
  lost_answers INTEGER NOT NULL CHECK (lost_answers = 0),
  duplicate_failures INTEGER NOT NULL CHECK (duplicate_failures = 0),
  d1_overload INTEGER NOT NULL CHECK (d1_overload = 0),
  app_5xx INTEGER NOT NULL CHECK (app_5xx = 0),
  network_errors INTEGER NOT NULL CHECK (network_errors = 0),
  status TEXT NOT NULL DEFAULT 'CERTIFIED' CHECK (status = 'CERTIFIED'),
  passed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_exam_capacity_profiles_passed
  ON live_exam_capacity_profiles(passed_at DESC, certified_concurrent_students DESC);
