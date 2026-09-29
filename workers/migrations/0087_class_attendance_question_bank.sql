-- Attendance question bank managed by the homeroom/class teacher.
CREATE TABLE IF NOT EXISTS class_attendance_settings (
  class_id TEXT PRIMARY KEY,
  is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS class_attendance_questions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  question_text TEXT NOT NULL,
  question_rich_text TEXT,
  options_json TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  image_url TEXT,
  image_alt TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE INDEX IF NOT EXISTS idx_class_attendance_questions_active
  ON class_attendance_questions(class_id, is_active, created_at);

CREATE TABLE IF NOT EXISTS attendance_attempts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  username TEXT NOT NULL,
  class_id TEXT NOT NULL,
  attempt_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
  correct_count INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 2,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(student_id, attempt_date),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_attempts_class_date
  ON attendance_attempts(class_id, attempt_date, status);

CREATE TABLE IF NOT EXISTS attendance_attempt_items (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  question_id TEXT,
  position INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_rich_text TEXT,
  options_json TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  image_url TEXT,
  image_alt TEXT,
  selected_answer TEXT,
  is_correct INTEGER,
  answered_at TEXT,
  UNIQUE(attempt_id, position),
  FOREIGN KEY (attempt_id) REFERENCES attendance_attempts(id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_attempt_items_attempt
  ON attendance_attempt_items(attempt_id, position);
