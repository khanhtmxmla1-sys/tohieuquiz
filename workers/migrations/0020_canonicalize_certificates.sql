-- Canonical certificate schema migration.
-- Production preflight (captured 2026-07-14) expects the legacy 004 + 010 shape.
-- Rehearse this migration on a copy before remote execution. Production execution belongs to Phase 6.

PRAGMA foreign_keys = OFF;

ALTER TABLE certificates RENAME TO certificates_legacy_0020;
ALTER TABLE certificate_batches RENAME TO certificate_batches_legacy_0020;
ALTER TABLE certificate_templates RENAME TO certificate_templates_legacy_0020;

-- SQLite keeps index names when their tables are renamed. Drop the legacy
-- indexes before recreating the canonical tables with the same index names.
DROP INDEX IF EXISTS idx_templates_school;
DROP INDEX IF EXISTS idx_templates_active;
DROP INDEX IF EXISTS idx_templates_created_by;
DROP INDEX IF EXISTS idx_batches_teacher;
DROP INDEX IF EXISTS idx_batches_status;
DROP INDEX IF EXISTS idx_certs_student;
DROP INDEX IF EXISTS idx_certs_batch;
DROP INDEX IF EXISTS idx_certs_status;

CREATE TABLE certificate_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  school_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  bg_image_r2_key TEXT NOT NULL,
  thumbnail_r2_key TEXT,
  fields_config TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE certificate_batches (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  teacher_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  class_id TEXT,
  quiz_id TEXT,
  template_id TEXT NOT NULL REFERENCES certificate_templates(id),
  title TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'processing', 'sent', 'partial', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  processing_started_at TEXT,
  error_message TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(teacher_id, request_id)
);

CREATE TABLE certificates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  batch_id TEXT NOT NULL REFERENCES certificate_batches(id),
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL DEFAULT '',
  student_score REAL,
  quiz_title TEXT,
  image_url TEXT,
  png_r2_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'revoked')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(batch_id, student_id)
);

INSERT INTO certificate_templates (
  id, school_id, name, description, bg_image_r2_key, thumbnail_r2_key,
  fields_config, is_active, created_by, created_at, updated_at
)
SELECT
  id, CASE WHEN created_by = 'admin' THEN NULL ELSE school_id END,
  name, description, bg_image_r2_key, thumbnail_r2_key,
  fields_config, is_active, created_by, created_at, COALESCE(updated_at, created_at)
FROM certificate_templates_legacy_0020;

INSERT INTO certificate_batches (
  id, teacher_id, request_id, class_id, quiz_id, template_id, title, message, status,
  attempt_count, processing_started_at, error_message, sent_at, created_at, updated_at
)
SELECT
  id, teacher_id, id, class_id, quiz_id, template_id, title,
  COALESCE(message, custom_note),
  CASE status
    WHEN 'draft' THEN 'pending'
    WHEN 'sending' THEN 'processing'
    WHEN 'sent' THEN 'sent'
    WHEN 'error' THEN 'failed'
    ELSE 'failed'
  END,
  0, NULL, NULL, sent_at, created_at, created_at
FROM certificate_batches_legacy_0020;

INSERT INTO certificates (
  id, batch_id, student_id, student_name, student_score, quiz_title,
  image_url, png_r2_key, status, attempt_count, error_message, issued_at, sent_at, updated_at
)
SELECT
  id, batch_id, student_id, student_name, student_score, quiz_title,
  image_url, png_r2_key,
  CASE
    WHEN is_revoked = 1 THEN 'revoked'
    WHEN status = 'sent' OR render_status = 'done' THEN 'sent'
    WHEN status = 'failed' OR render_status = 'error' THEN 'failed'
    WHEN status = 'processing' THEN 'processing'
    ELSE 'pending'
  END,
  0, error_message, issued_at, sent_at, COALESCE(sent_at, issued_at)
FROM certificates_legacy_0020;

CREATE INDEX idx_templates_school ON certificate_templates(school_id);
CREATE INDEX idx_templates_active ON certificate_templates(is_active);
CREATE INDEX idx_templates_created_by ON certificate_templates(created_by);
CREATE INDEX idx_batches_teacher ON certificate_batches(teacher_id);
CREATE INDEX idx_batches_status ON certificate_batches(status);
CREATE INDEX idx_certs_student ON certificates(student_id);
CREATE INDEX idx_certs_batch ON certificates(batch_id);
CREATE INDEX idx_certs_status ON certificates(status);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK(user_role IN ('student', 'teacher', 'admin')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, user_role, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

DROP TABLE certificates_legacy_0020;
DROP TABLE certificate_batches_legacy_0020;
DROP TABLE certificate_templates_legacy_0020;

PRAGMA foreign_keys = ON;
