ALTER TABLE notifications ADD COLUMN severity TEXT NOT NULL DEFAULT 'informational'
  CHECK (severity IN ('critical', 'action_required', 'informational'));
ALTER TABLE notifications ADD COLUMN dedupe_key TEXT;
ALTER TABLE notifications ADD COLUMN available_at TEXT;
ALTER TABLE notifications ADD COLUMN read_at TEXT;
ALTER TABLE notifications ADD COLUMN clicked_at TEXT;
ALTER TABLE notifications ADD COLUMN sent_at TEXT;

UPDATE notifications
SET severity = CASE
  WHEN priority = 'URGENT' THEN 'critical'
  WHEN priority IN ('IMPORTANT', 'REMINDER') THEN 'action_required'
  ELSE 'informational'
END,
available_at = COALESCE(available_at, created_at),
read_at = CASE WHEN is_read = 1 THEN COALESCE(read_at, created_at) ELSE read_at END,
sent_at = COALESCE(sent_at, created_at);

DROP INDEX IF EXISTS idx_notifications_source_dedupe;

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK(user_role IN ('student', 'teacher', 'admin')),
  action_required_enabled INTEGER NOT NULL DEFAULT 1 CHECK(action_required_enabled IN (0, 1)),
  informational_enabled INTEGER NOT NULL DEFAULT 1 CHECK(informational_enabled IN (0, 1)),
  quiet_hours_enabled INTEGER NOT NULL DEFAULT 0 CHECK(quiet_hours_enabled IN (0, 1)),
  quiet_start TEXT NOT NULL DEFAULT '21:00',
  quiet_end TEXT NOT NULL DEFAULT '06:30',
  timezone_offset_minutes INTEGER NOT NULL DEFAULT 420 CHECK(timezone_offset_minutes BETWEEN -720 AND 840),
  type_preferences_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, user_role)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_window_dedupe
  ON notifications(user_id, user_role, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_feed
  ON notifications(user_id, user_role, available_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_metrics
  ON notifications(sent_at, severity, read_at, clicked_at);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_role
  ON notification_preferences(user_role, updated_at DESC);
