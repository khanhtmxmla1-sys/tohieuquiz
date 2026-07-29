-- Task 23: Results Intervention Center with private notes, audited groups and idempotent batch assignments.
ALTER TABLE assignments ADD COLUMN intervention_group_id TEXT;

CREATE TABLE IF NOT EXISTS intervention_groups (
  id TEXT PRIMARY KEY,
  teacher_username TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  class_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  subject_label TEXT NOT NULL,
  skill_code TEXT NOT NULL,
  skill_label TEXT NOT NULL,
  sample_size INTEGER NOT NULL CHECK (sample_size >= 0),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_filter_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (teacher_username) REFERENCES teachers(username) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intervention_group_members (
  group_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  latest_result_id TEXT NOT NULL,
  latest_submitted_at TEXT NOT NULL,
  first_attempt_score REAL NOT NULL,
  latest_attempt_score REAL NOT NULL,
  score_delta REAL NOT NULL,
  attempt_count INTEGER NOT NULL,
  skill_accuracy REAL NOT NULL,
  skill_sample_size INTEGER NOT NULL,
  confidence REAL NOT NULL,
  trend_json TEXT NOT NULL DEFAULT '[]',
  added_at TEXT NOT NULL,
  PRIMARY KEY (group_id, student_id),
  FOREIGN KEY (group_id) REFERENCES intervention_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intervention_notes (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  student_id TEXT,
  teacher_username TEXT NOT NULL,
  note_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES intervention_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  FOREIGN KEY (teacher_username) REFERENCES teachers(username) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intervention_assignment_batches (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  teacher_username TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  deadline TEXT NOT NULL,
  max_attempts INTEGER NOT NULL,
  assignment_ids_json TEXT NOT NULL DEFAULT '[]',
  skipped_assignment_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  UNIQUE (teacher_username, idempotency_key),
  FOREIGN KEY (group_id) REFERENCES intervention_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_username) REFERENCES teachers(username) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intervention_audit (
  id TEXT PRIMARY KEY,
  teacher_username TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('GROUP_CREATED', 'NOTE_CREATED', 'ASSIGNMENT_BATCH_CREATED')),
  group_id TEXT,
  student_id TEXT,
  assignment_id TEXT,
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (teacher_username) REFERENCES teachers(username) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES intervention_groups(id) ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_intervention_groups_teacher_updated
  ON intervention_groups(teacher_username, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_intervention_groups_class_skill
  ON intervention_groups(class_id, subject, skill_code, status);
CREATE INDEX IF NOT EXISTS idx_intervention_members_student
  ON intervention_group_members(student_id, group_id);
CREATE INDEX IF NOT EXISTS idx_intervention_notes_group_created
  ON intervention_notes(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intervention_audit_group_created
  ON intervention_audit(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_intervention_group
  ON assignments(intervention_group_id, student_id, status);
