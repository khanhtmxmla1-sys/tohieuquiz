-- SQLite cannot drop the nullable assignments.intervention_group_id column without rebuilding the table.
DROP INDEX IF EXISTS idx_assignments_intervention_group;
DROP INDEX IF EXISTS idx_intervention_audit_group_created;
DROP INDEX IF EXISTS idx_intervention_notes_group_created;
DROP INDEX IF EXISTS idx_intervention_members_student;
DROP INDEX IF EXISTS idx_intervention_groups_class_skill;
DROP INDEX IF EXISTS idx_intervention_groups_teacher_updated;
DROP TABLE IF EXISTS intervention_audit;
DROP TABLE IF EXISTS intervention_assignment_batches;
DROP TABLE IF EXISTS intervention_notes;
DROP TABLE IF EXISTS intervention_group_members;
DROP TABLE IF EXISTS intervention_groups;
