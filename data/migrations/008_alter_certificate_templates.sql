-- ============================================================
-- Migration 008: Thêm các cột còn thiếu vào certificate_templates
-- Giải quyết conflict giữa 004 và 006
-- Date: 2026-07-14
-- ============================================================

-- Thêm description (có trong 006 nhưng không có trong 004)
ALTER TABLE certificate_templates ADD COLUMN description TEXT;

-- Thêm thumbnail_r2_key nếu chưa có (trong 004 có, phòng trường hợp chạy thiếu)
-- ALTER TABLE certificate_templates ADD COLUMN thumbnail_r2_key TEXT;

-- Thêm updated_at để tracking thay đổi template
ALTER TABLE certificate_templates ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

-- Tạo trigger tự update updated_at khi UPDATE (SQLite syntax)
CREATE TRIGGER IF NOT EXISTS trg_cert_templates_updated
  AFTER UPDATE ON certificate_templates
  FOR EACH ROW
  BEGIN
    UPDATE certificate_templates SET updated_at = datetime('now') WHERE id = OLD.id;
  END;
