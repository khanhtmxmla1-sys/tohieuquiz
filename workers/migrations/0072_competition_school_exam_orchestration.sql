-- Competition V1 Task 12: school-exam orchestration state needed for
-- idempotent room planning, form-equivalence validation, capacity preflight,
-- and retryable Live Exam provisioning.

ALTER TABLE competition_school_exam_events ADD COLUMN create_request_id TEXT;
ALTER TABLE competition_school_exam_events ADD COLUMN preflight_json TEXT;
ALTER TABLE competition_school_exam_events ADD COLUMN preflight_at TEXT;

ALTER TABLE competition_school_exam_rooms ADD COLUMN member_count INTEGER NOT NULL DEFAULT 0
  CHECK (member_count >= 0);
ALTER TABLE competition_school_exam_rooms ADD COLUMN form_definition_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE competition_school_exam_rooms ADD COLUMN equivalent_form_approved_by TEXT;
ALTER TABLE competition_school_exam_rooms ADD COLUMN equivalent_form_approved_at TEXT;
ALTER TABLE competition_school_exam_rooms ADD COLUMN provision_status TEXT NOT NULL DEFAULT 'PENDING'
  CHECK (provision_status IN ('PENDING', 'READY', 'FAILED'));
ALTER TABLE competition_school_exam_rooms ADD COLUMN provision_error_code TEXT;
ALTER TABLE competition_school_exam_rooms ADD COLUMN create_request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_events_create_request
  ON competition_school_exam_events(campaign_id, create_request_id)
  WHERE create_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_rooms_create_request
  ON competition_school_exam_rooms(event_id, create_request_id)
  WHERE create_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_school_exam_rooms_provision
  ON competition_school_exam_rooms(event_id, provision_status, live_exam_session_id);
