-- ============================================================
-- Migration 007: Notifications + Rate Limits
-- Unblocks: Epic 4 (Realtime), Task 3.3, Task 4.5
-- Date: 2026-07-14
-- ============================================================

-- Bảng thông báo cho học sinh/giáo viên
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,          -- student_id hoặc teacher_id
  user_role TEXT NOT NULL CHECK(user_role IN ('student','teacher','admin')),
  type TEXT NOT NULL,             -- 'certificate_issued', 'badge_earned', 'quest_complete', etc.
  title TEXT NOT NULL,
  body TEXT,
  data TEXT DEFAULT '{}',         -- JSON payload (cert id, badge id...)
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Bảng rate limiting (D1-based, dùng bởi security middleware)
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,           -- e.g. 'login:ip:1.2.3.4'
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
