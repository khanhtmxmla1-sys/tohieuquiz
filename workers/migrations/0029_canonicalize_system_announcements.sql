ALTER TABLE announcements ADD COLUMN status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED'));
ALTER TABLE announcements ADD COLUMN audience TEXT NOT NULL DEFAULT 'ALL' CHECK (audience IN ('ALL', 'TEACHERS', 'STUDENTS'));
ALTER TABLE announcements ADD COLUMN starts_at TEXT;
ALTER TABLE announcements ADD COLUMN ends_at TEXT;
ALTER TABLE announcements ADD COLUMN created_by TEXT;
ALTER TABLE announcements ADD COLUMN updated_by TEXT;
ALTER TABLE announcements ADD COLUMN created_at TEXT;

UPDATE announcements
SET status = CASE
      WHEN id = '1' AND (is_active IN ('true', 'TRUE') OR is_banner_active IN ('true', 'TRUE')) THEN 'PUBLISHED'
      WHEN id = '1' THEN 'DRAFT'
      ELSE 'ARCHIVED'
    END,
    audience = 'ALL',
    starts_at = CASE
      WHEN id = '1' AND (is_active IN ('true', 'TRUE') OR is_banner_active IN ('true', 'TRUE'))
      THEN COALESCE(NULLIF(updated_at, ''), datetime('now'))
      ELSE NULL
    END,
    created_at = COALESCE(NULLIF(updated_at, ''), datetime('now')),
    created_by = 'migration',
    updated_by = 'migration';

CREATE INDEX IF NOT EXISTS idx_announcements_delivery
ON announcements(status, audience, starts_at, ends_at);
