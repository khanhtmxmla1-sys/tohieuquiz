-- Migration 0026: Harden live exam lifecycle and replace destructive deletion with archive.
ALTER TABLE live_exam_sessions ADD COLUMN archived_at TEXT;

-- Preserve legacy sessions created before class selection became mandatory.
-- The participant's current class is the safest server-owned source available.
UPDATE live_exam_sessions
SET class_id = (
  SELECT students.class_id
  FROM live_exam_participants
  JOIN students ON students.id = live_exam_participants.student_id
  WHERE live_exam_participants.live_exam_id = live_exam_sessions.id
    AND students.class_id IS NOT NULL
  ORDER BY live_exam_participants.joined_at ASC
  LIMIT 1
)
WHERE (class_id IS NULL OR class_id = '')
  AND EXISTS (
    SELECT 1
    FROM live_exam_participants
    JOIN students ON students.id = live_exam_participants.student_id
    WHERE live_exam_participants.live_exam_id = live_exam_sessions.id
      AND students.class_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_teacher_archive_status
ON live_exam_sessions(teacher_id, archived_at, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_access_active
ON live_exam_sessions(access_code, archived_at, status);
