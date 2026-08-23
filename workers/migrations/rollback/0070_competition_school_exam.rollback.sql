-- Roll back Competition V1 school-exam persistence only.
-- SQLite additive columns on live_exam_sessions are intentionally retained:
-- participant_scope_type, participant_scope_id, and result_visibility.
-- Retaining them preserves backward compatibility for existing class Live Exam
-- sessions, which continue to use CLASS + PUBLISHED defaults.

-- These triggers reference school-exam tables and must be removed before those
-- tables are dropped. Class-only compatibility triggers remain valid because the
-- retained additive columns still exist.
DROP TRIGGER IF EXISTS trg_live_exam_scope_update;
DROP TRIGGER IF EXISTS trg_live_exam_school_scope_insert;
DROP TRIGGER IF EXISTS trg_live_exam_school_class_forbidden_insert;
DROP TRIGGER IF EXISTS trg_school_exam_event_eligibility_reference_immutable;
DROP TRIGGER IF EXISTS trg_school_exam_event_eligibility_insert;

DROP INDEX IF EXISTS idx_live_exam_sessions_participant_scope;

-- Drop in reverse dependency order.
DROP TABLE IF EXISTS competition_school_exam_audit;
DROP TABLE IF EXISTS competition_school_exam_certificate_batches;
DROP TABLE IF EXISTS competition_school_exam_exports;
DROP TABLE IF EXISTS competition_school_exam_publications;
DROP TABLE IF EXISTS competition_school_exam_reconcile_runs;
DROP TABLE IF EXISTS competition_school_exam_retests;
DROP TABLE IF EXISTS competition_school_exam_incidents;
DROP TABLE IF EXISTS competition_school_exam_results;
DROP TABLE IF EXISTS competition_school_exam_members;
DROP TABLE IF EXISTS competition_school_exam_rooms;
DROP TABLE IF EXISTS competition_school_exam_events;
