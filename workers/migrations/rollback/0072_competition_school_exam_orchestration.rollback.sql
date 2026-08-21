-- Roll back Task 12 orchestration-only columns. Task 8 school-exam tables remain.
DROP INDEX IF EXISTS idx_school_exam_rooms_provision;
DROP INDEX IF EXISTS idx_school_exam_rooms_create_request;
DROP INDEX IF EXISTS idx_school_exam_events_create_request;

ALTER TABLE competition_school_exam_rooms DROP COLUMN create_request_id;
ALTER TABLE competition_school_exam_rooms DROP COLUMN provision_error_code;
ALTER TABLE competition_school_exam_rooms DROP COLUMN provision_status;
ALTER TABLE competition_school_exam_rooms DROP COLUMN equivalent_form_approved_at;
ALTER TABLE competition_school_exam_rooms DROP COLUMN equivalent_form_approved_by;
ALTER TABLE competition_school_exam_rooms DROP COLUMN form_definition_json;
ALTER TABLE competition_school_exam_rooms DROP COLUMN member_count;

ALTER TABLE competition_school_exam_events DROP COLUMN preflight_at;
ALTER TABLE competition_school_exam_events DROP COLUMN preflight_json;
ALTER TABLE competition_school_exam_events DROP COLUMN create_request_id;
