-- Expand intervention lifecycle audit actions without losing existing audit history.
CREATE TABLE intervention_audit_v2 (
  id TEXT PRIMARY KEY,
  teacher_username TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'GROUP_CREATED',
    'GROUP_ARCHIVED',
    'NOTE_CREATED',
    'ASSIGNMENT_BATCH_CREATED'
  )),
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

INSERT INTO intervention_audit_v2 (
  id,
  teacher_username,
  action,
  group_id,
  student_id,
  assignment_id,
  request_id,
  metadata_json,
  created_at
)
SELECT
  id,
  teacher_username,
  action,
  group_id,
  student_id,
  assignment_id,
  request_id,
  metadata_json,
  created_at
FROM intervention_audit;

DROP TABLE intervention_audit;
ALTER TABLE intervention_audit_v2 RENAME TO intervention_audit;

CREATE INDEX IF NOT EXISTS idx_intervention_audit_group_created
  ON intervention_audit(group_id, created_at DESC);
