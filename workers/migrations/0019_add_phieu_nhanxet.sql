CREATE TABLE IF NOT EXISTS phieu_nhanxet (
  id                TEXT PRIMARY KEY,
  submission_id     TEXT NOT NULL UNIQUE,
  student_id        TEXT NOT NULL,
  student_name      TEXT NOT NULL,
  class_id          TEXT NOT NULL,
  mon_hoc           TEXT DEFAULT '',
  ten_bai_tap       TEXT DEFAULT '',
  ngay_lam_bai      TEXT DEFAULT '',
  tong_cau          INTEGER DEFAULT 0,
  so_cau_dung       INTEGER DEFAULT 0,
  so_cau_sai        INTEGER DEFAULT 0,
  diem_so           REAL DEFAULT 0,
  xep_loai          TEXT DEFAULT 'Trung binh',
  nhan_xet_mode     TEXT DEFAULT 'ai',
  nhan_xet_style    TEXT DEFAULT 'nhe_nhang',
  nhan_xet          TEXT DEFAULT '',
  noi_dung_co_gang  TEXT DEFAULT '',
  loi_dong_vien     TEXT DEFAULT '',
  status            TEXT DEFAULT 'draft',
  version           INTEGER DEFAULT 1,
  created_by        TEXT DEFAULT 'teacher',
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phieu_batch (
  id            TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  class_id      TEXT NOT NULL,
  teacher_id    TEXT NOT NULL,
  title         TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  expires_at    TEXT,
  view_count    INTEGER DEFAULT 0,
  is_active     INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS phieu_batch_items (
  batch_id      TEXT NOT NULL,
  phieu_id      TEXT NOT NULL,
  student_name  TEXT,
  PRIMARY KEY (batch_id, phieu_id)
);

CREATE TABLE IF NOT EXISTS phieu_public_links (
  id            TEXT PRIMARY KEY,
  phieu_id      TEXT NOT NULL,
  batch_id      TEXT,
  public_token  TEXT NOT NULL UNIQUE,
  is_active     INTEGER DEFAULT 1,
  expires_at    TEXT,
  view_count    INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_phieu_student ON phieu_nhanxet(student_id);
CREATE INDEX IF NOT EXISTS idx_phieu_submission ON phieu_nhanxet(submission_id);
CREATE INDEX IF NOT EXISTS idx_batch_assign ON phieu_batch(assignment_id);
CREATE INDEX IF NOT EXISTS idx_batch_items ON phieu_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_public_links_phieu ON phieu_public_links(phieu_id);
CREATE INDEX IF NOT EXISTS idx_public_links_batch ON phieu_public_links(batch_id);
CREATE INDEX IF NOT EXISTS idx_phieu_public_links_token ON phieu_public_links(public_token);
CREATE INDEX IF NOT EXISTS idx_phieu_nhanxet_submission_id ON phieu_nhanxet(submission_id);
CREATE INDEX IF NOT EXISTS idx_phieu_batch_items_batch_id ON phieu_batch_items(batch_id);
