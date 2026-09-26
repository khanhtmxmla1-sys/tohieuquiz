-- Per-account default AI source. API keys remain in teacher_ai_credentials.

CREATE TABLE IF NOT EXISTS teacher_ai_preferences (
  username TEXT PRIMARY KEY,
  default_source TEXT NOT NULL DEFAULT 'system'
    CHECK (default_source IN ('system', 'gemini-personal', 'deepseek-personal')),
  updated_at TEXT NOT NULL,
  FOREIGN KEY (username) REFERENCES teachers(username) ON DELETE CASCADE
);
