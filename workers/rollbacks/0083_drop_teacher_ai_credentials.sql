-- Roll back server-stored teacher AI credentials while preserving action history.
-- The BYOK rollout flag is removed first so no new personal requests can start.
-- ai_generation_actions source/credential/model/reservation columns are retained intentionally:
-- SQLite destructive column removal would require rebuilding a live shared table, and the
-- retained columns are inert for legacy/system traffic because source defaults to 'system'.

DELETE FROM feature_flag_rules WHERE flag_key = 'teacher_ai_byok_v1';
DELETE FROM feature_flags WHERE flag_key = 'teacher_ai_byok_v1';

DROP TRIGGER IF EXISTS trg_teacher_ai_credential_audit_immutable_delete;
DROP TRIGGER IF EXISTS trg_teacher_ai_credential_audit_immutable_update;
DROP TABLE IF EXISTS teacher_ai_credential_audit;
DROP TABLE IF EXISTS teacher_ai_credentials;
