CREATE TABLE IF NOT EXISTS student_game_profiles (
  username TEXT PRIMARY KEY,
  daily_streak INTEGER NOT NULL DEFAULT 0,
  last_mission_completion_date TEXT DEFAULT '',
  hint_tokens INTEGER NOT NULL DEFAULT 0,
  streak_shields INTEGER NOT NULL DEFAULT 0,
  collection_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_daily_progress (
  username TEXT NOT NULL,
  progress_date TEXT NOT NULL,
  questions_answered INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  quizzes_completed INTEGER NOT NULL DEFAULT 0,
  toan_quizzes_completed INTEGER NOT NULL DEFAULT 0,
  tieng_viet_quizzes_completed INTEGER NOT NULL DEFAULT 0,
  mission_questions_claimed INTEGER NOT NULL DEFAULT 0,
  mission_accuracy_claimed INTEGER NOT NULL DEFAULT 0,
  mission_subject_claimed INTEGER NOT NULL DEFAULT 0,
  chest_claimed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (username, progress_date)
);

CREATE TABLE IF NOT EXISTS student_achievement_unlocks (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  achievement_code TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS student_reward_events (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_game_activity_events (
  activity_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_achievement_user_code
ON student_achievement_unlocks(username, achievement_code);

CREATE INDEX IF NOT EXISTS idx_game_reward_events_user_date
ON student_reward_events(username, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_activity_events_user_date
ON student_game_activity_events(username, created_at DESC);
