ALTER TABLE teachers ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED'));
ALTER TABLE teachers ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1));
ALTER TABLE teachers ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE teachers ADD COLUMN password_changed_at TEXT;
ALTER TABLE teachers ADD COLUMN last_login_at TEXT;
ALTER TABLE teachers ADD COLUMN disabled_at TEXT;
ALTER TABLE teachers ADD COLUMN disabled_by TEXT;
ALTER TABLE teachers ADD COLUMN disabled_reason TEXT;
ALTER TABLE teachers ADD COLUMN created_at TEXT;
ALTER TABLE teachers ADD COLUMN updated_at TEXT;

UPDATE teachers
SET status = 'ACTIVE',
    must_change_password = 1,
    token_version = 1,
    created_at = COALESCE(created_at, datetime('now')),
    updated_at = COALESCE(updated_at, datetime('now'));

CREATE INDEX IF NOT EXISTS idx_teachers_status_role ON teachers(status, role, username);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_username ON classes(teacher_username, archived_at);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_created ON admin_audit_logs(actor_username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_created ON admin_audit_logs(target_type, target_id, created_at DESC);
