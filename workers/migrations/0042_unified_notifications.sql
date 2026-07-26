ALTER TABLE announcements ADD COLUMN priority TEXT NOT NULL DEFAULT 'INFO'
  CHECK (priority IN ('INFO', 'REMINDER', 'IMPORTANT', 'URGENT'));
ALTER TABLE announcements ADD COLUMN channels_json TEXT NOT NULL DEFAULT '["TICKER"]';
ALTER TABLE announcements ADD COLUMN dismissible INTEGER NOT NULL DEFAULT 1
  CHECK (dismissible IN (0, 1));
ALTER TABLE announcements ADD COLUMN cta_label TEXT;
ALTER TABLE announcements ADD COLUMN surface_overrides_json TEXT NOT NULL DEFAULT '{}';

UPDATE announcements
SET channels_json = CASE
  WHEN is_active IN ('true', 'TRUE') AND is_banner_active IN ('true', 'TRUE')
    THEN '["TICKER","BANNER"]'
  WHEN is_banner_active IN ('true', 'TRUE')
    THEN '["BANNER"]'
  WHEN is_active IN ('true', 'TRUE')
    THEN '["TICKER"]'
  ELSE '[]'
END;

ALTER TABLE notifications ADD COLUMN priority TEXT NOT NULL DEFAULT 'INFO'
  CHECK (priority IN ('INFO', 'REMINDER', 'IMPORTANT', 'URGENT'));
ALTER TABLE notifications ADD COLUMN action_url TEXT;
ALTER TABLE notifications ADD COLUMN source_type TEXT;
ALTER TABLE notifications ADD COLUMN source_id TEXT;
ALTER TABLE notifications ADD COLUMN expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_inbox
  ON notifications(user_id, user_role, is_read, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source_dedupe
  ON notifications(user_id, user_role, source_type, source_id, type)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
