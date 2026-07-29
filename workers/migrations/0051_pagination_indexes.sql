CREATE INDEX IF NOT EXISTS idx_results_cursor
  ON results(submitted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_results_quiz_cursor
  ON results(quiz_id, submitted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_results_class_cursor
  ON results(class_name, submitted_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_students_class_name_cursor
  ON students(class_id, archived_at, full_name COLLATE NOCASE, id);
CREATE INDEX IF NOT EXISTS idx_teachers_admin_cursor
  ON teachers(status, full_name COLLATE NOCASE, username);

CREATE INDEX IF NOT EXISTS idx_gift_orders_class_cursor
  ON gift_orders(class_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_gift_orders_student_cursor
  ON gift_orders(student_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_gift_orders_status_cursor
  ON gift_orders(status, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_feed_cursor
  ON notifications(user_id, user_role, is_read, created_at DESC, id DESC);
