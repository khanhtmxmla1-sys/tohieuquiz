-- ============================================================
-- Migration 004: Certificate System
-- Tables: certificate_templates, certificate_batches, certificates
-- ============================================================

-- Template do admin trường tạo
CREATE TABLE IF NOT EXISTS certificate_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  school_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bg_image_r2_key TEXT NOT NULL,
  thumbnail_r2_key TEXT,
  fields_config TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL
);

-- Đợt phát của giáo viên
CREATE TABLE IF NOT EXISTS certificate_batches (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  teacher_id TEXT NOT NULL,
  class_id TEXT,
  quiz_id TEXT,
  template_id TEXT NOT NULL REFERENCES certificate_templates(id),
  title TEXT NOT NULL,
  custom_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sending','sent','error')),
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Từng chứng nhận cho từng học sinh
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  batch_id TEXT NOT NULL REFERENCES certificate_batches(id),
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  student_score REAL,
  quiz_title TEXT,
  png_r2_key TEXT,
  render_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(render_status IN ('pending','done','error')),
  error_message TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_revoked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_certs_student ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certs_batch ON certificates(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_teacher ON certificate_batches(teacher_id);
CREATE INDEX IF NOT EXISTS idx_templates_school ON certificate_templates(school_id);
