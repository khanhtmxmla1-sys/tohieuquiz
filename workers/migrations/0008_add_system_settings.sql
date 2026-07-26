-- Global system settings

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO system_settings (setting_key, setting_value, updated_at)
VALUES ('ai_assistant_enabled', 'true', datetime('now'));

