DROP INDEX IF EXISTS idx_feature_flag_audit_actor_created;
DROP INDEX IF EXISTS idx_feature_flag_audit_flag_created;
DROP TABLE IF EXISTS feature_flag_audit;
DROP TABLE IF EXISTS feature_flag_rules;
DROP TABLE IF EXISTS feature_flags;

-- Existing system_settings rows are retained so rollback restores the legacy
-- runtime toggles without requiring a frontend or Worker redeploy.
