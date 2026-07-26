PRAGMA foreign_keys = OFF;

CREATE TABLE hw_assignments_v2 (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL,
  class_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  file_url TEXT NOT NULL DEFAULT '',
  ai_content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED')),
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 10),
  published_at TEXT,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  source_ocr_text TEXT NOT NULL DEFAULT '',
  rubric_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

INSERT INTO hw_assignments_v2 (
  id, title, description, subject, deadline, class_id, teacher_id, file_url, ai_content,
  status, max_attempts, published_at, updated_at, archived_at, source_ocr_text, rubric_json, created_at
)
SELECT
  id, title, COALESCE(description, ''), COALESCE(subject, ''), deadline, class_id, teacher_id,
  COALESCE(file_url, ''), COALESCE(ai_content, ''),
  CASE WHEN julianday(deadline) <= julianday('now') THEN 'CLOSED' ELSE 'OPEN' END,
  1,
  created_at,
  created_at,
  NULL,
  COALESCE(ai_content, ''),
  '[]',
  created_at
FROM hw_assignments;

CREATE TABLE hw_submissions_v2 (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'AI_REVIEW', 'GRADED')),
  file_urls TEXT NOT NULL DEFAULT '[]',
  student_note TEXT NOT NULL DEFAULT '',
  teacher_feedback TEXT NOT NULL DEFAULT '',
  ai_evaluation TEXT NOT NULL DEFAULT '',
  score REAL NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 10),
  submitted_at TEXT NOT NULL,
  analytics_json TEXT NOT NULL DEFAULT '[]',
  attempt_no INTEGER NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
  idempotency_key TEXT NOT NULL,
  ai_score REAL,
  ai_confidence REAL,
  ai_feedback TEXT NOT NULL DEFAULT '',
  grading_breakdown_json TEXT NOT NULL DEFAULT '[]',
  graded_by TEXT,
  graded_at TEXT,
  published_at TEXT,
  FOREIGN KEY (assignment_id) REFERENCES hw_assignments_v2(id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  UNIQUE (assignment_id, student_id, attempt_no),
  UNIQUE (student_id, idempotency_key)
);

INSERT INTO hw_submissions_v2 (
  id, assignment_id, student_id, student_name, status, file_urls, student_note,
  teacher_feedback, ai_evaluation, score, submitted_at, analytics_json, attempt_no,
  idempotency_key, ai_score, ai_confidence, ai_feedback, grading_breakdown_json,
  graded_by, graded_at, published_at
)
SELECT
  id, assignment_id, student_id, student_name,
  CASE WHEN status = 'GRADED' THEN 'GRADED' ELSE 'SUBMITTED' END,
  COALESCE(file_urls, '[]'), COALESCE(student_note, ''), COALESCE(teacher_feedback, ''),
  COALESCE(ai_evaluation, ''), MIN(10, MAX(0, COALESCE(score, 0))), submitted_at,
  COALESCE(analytics_json, '[]'), 1, 'legacy:' || id,
  CASE WHEN COALESCE(ai_evaluation, '') <> '' THEN MIN(10, MAX(0, COALESCE(score, 0))) END,
  NULL, COALESCE(ai_evaluation, ''), COALESCE(analytics_json, '[]'),
  CASE WHEN status = 'GRADED' THEN 'legacy' END,
  CASE WHEN status = 'GRADED' THEN submitted_at END,
  CASE WHEN status = 'GRADED' THEN submitted_at END
FROM hw_submissions;

DROP TABLE hw_submissions;
DROP TABLE hw_assignments;
ALTER TABLE hw_assignments_v2 RENAME TO hw_assignments;
ALTER TABLE hw_submissions_v2 RENAME TO hw_submissions;

CREATE INDEX idx_hw_assignments_class_status ON hw_assignments(class_id, status, deadline);
CREATE INDEX idx_hw_assignments_teacher_status ON hw_assignments(teacher_id, status, deadline);
CREATE INDEX idx_hw_submissions_assignment_latest ON hw_submissions(assignment_id, student_id, attempt_no DESC);
CREATE INDEX idx_hw_submissions_student_latest ON hw_submissions(student_id, submitted_at DESC);
CREATE INDEX idx_hw_submissions_published ON hw_submissions(assignment_id, published_at, submitted_at DESC);

PRAGMA foreign_keys = ON;
