-- Preserve historical learning data when a class or student is removed from the active roster.
ALTER TABLE classes ADD COLUMN archived_at TEXT;
ALTER TABLE students ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_classes_active_teacher
  ON classes(teacher_username, archived_at);
CREATE INDEX IF NOT EXISTS idx_students_active_class
  ON students(class_id, archived_at);
