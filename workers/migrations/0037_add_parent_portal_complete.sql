ALTER TABLE results ADD COLUMN student_id TEXT;

UPDATE results
SET student_id = (
  SELECT s.id
  FROM students s
  JOIN classes c ON c.id = s.class_id
  WHERE LOWER(TRIM(s.full_name)) = LOWER(TRIM(results.student_name))
    AND LOWER(TRIM(c.name)) = LOWER(TRIM(results.class_name))
    AND COALESCE(s.archived_at, '') = ''
  LIMIT 1
)
WHERE COALESCE(student_id, '') = ''
  AND 1 = (
    SELECT COUNT(*)
    FROM students s
    JOIN classes c ON c.id = s.class_id
    WHERE LOWER(TRIM(s.full_name)) = LOWER(TRIM(results.student_name))
      AND LOWER(TRIM(c.name)) = LOWER(TRIM(results.class_name))
      AND COALESCE(s.archived_at, '') = ''
  );

CREATE INDEX IF NOT EXISTS idx_results_student_id_submitted
  ON results(student_id, submitted_at DESC);

CREATE TABLE parent_links (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  pin_hash TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING', 'ACTIVE', 'REVOKED')),
  token_version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  activated_at TEXT,
  revoked_at TEXT,
  last_accessed_at TEXT,
  FOREIGN KEY(student_id) REFERENCES students(id)
);

CREATE UNIQUE INDEX idx_parent_links_one_active_student
  ON parent_links(student_id)
  WHERE status IN ('PENDING', 'ACTIVE');
CREATE INDEX idx_parent_links_creator_created
  ON parent_links(created_by, created_at DESC);

CREATE TABLE parent_activation_tokens (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(link_id) REFERENCES parent_links(id)
);
CREATE INDEX idx_parent_activation_link
  ON parent_activation_tokens(link_id, expires_at DESC);

CREATE TABLE parent_class_announcements (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_important INTEGER NOT NULL DEFAULT 0 CHECK(is_important IN (0,1)),
  status TEXT NOT NULL DEFAULT 'PUBLISHED'
    CHECK(status IN ('PUBLISHED', 'REVOKED')),
  created_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY(class_id) REFERENCES classes(id)
);
CREATE INDEX idx_parent_announcements_class_published
  ON parent_class_announcements(class_id, published_at DESC);

CREATE TABLE parent_notifications (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN (
    'quiz_result','result_report','homework_assigned','homework_due',
    'homework_graded','class_announcement','certificate_issued'
  )),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  is_important INTEGER NOT NULL DEFAULT 0 CHECK(is_important IN (0,1)),
  published_at TEXT NOT NULL,
  expires_at TEXT,
  read_at TEXT,
  revoked_at TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL,
  FOREIGN KEY(student_id) REFERENCES students(id)
);
CREATE UNIQUE INDEX idx_parent_notifications_unique_source
  ON parent_notifications(student_id, source_type, source_id);
CREATE INDEX idx_parent_notifications_student_feed
  ON parent_notifications(student_id, revoked_at, published_at DESC);
CREATE INDEX idx_parent_notifications_student_unread
  ON parent_notifications(student_id, read_at, published_at DESC);
