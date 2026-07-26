ALTER TABLE phieu_batch ADD COLUMN request_id TEXT;
ALTER TABLE phieu_batch ADD COLUMN quiz_id TEXT;
ALTER TABLE phieu_batch ADD COLUMN attempt_policy TEXT
  CHECK (attempt_policy IS NULL OR attempt_policy IN ('latest', 'highest', 'first'));
ALTER TABLE phieu_batch ADD COLUMN notify_students INTEGER NOT NULL DEFAULT 0
  CHECK (notify_students IN (0, 1));
ALTER TABLE phieu_batch ADD COLUMN create_parent_links INTEGER NOT NULL DEFAULT 0
  CHECK (create_parent_links IN (0, 1));
ALTER TABLE phieu_batch ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (delivery_status IN ('draft', 'sending', 'completed', 'partial_failed'));
ALTER TABLE phieu_batch ADD COLUMN updated_at TEXT;

UPDATE phieu_batch
SET updated_at = COALESCE(updated_at, created_at, datetime('now'))
WHERE updated_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_phieu_batch_teacher_request
  ON phieu_batch (teacher_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS result_report_delivery_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  result_id TEXT NOT NULL,
  phieu_id TEXT,
  student_id TEXT,
  student_name TEXT NOT NULL,
  parent_phone TEXT,
  notification_id TEXT,
  public_link_id TEXT,
  student_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (student_status IN ('not_requested', 'pending', 'sent', 'viewed', 'failed', 'unresolved')),
  parent_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (parent_status IN ('not_requested', 'link_created', 'opened', 'revoked', 'failed')),
  draft_json TEXT NOT NULL DEFAULT '{}',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (batch_id, result_id)
);

CREATE INDEX IF NOT EXISTS idx_result_report_items_batch
  ON result_report_delivery_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_result_report_items_student
  ON result_report_delivery_items (student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_result_report_items_notification
  ON result_report_delivery_items (notification_id);
CREATE INDEX IF NOT EXISTS idx_result_report_items_public_link
  ON result_report_delivery_items (public_link_id);
