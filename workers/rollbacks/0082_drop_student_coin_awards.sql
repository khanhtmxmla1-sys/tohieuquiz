-- Roll back student coin award persistence and its disabled rollout seed.
-- Existing student_reward_ledger entries are intentionally retained; they are
-- owned by migration 0066 and are not deleted by this rollback.

DROP TRIGGER IF EXISTS trg_coin_award_teacher_limits;
DROP TRIGGER IF EXISTS trg_coin_award_settings_required;
DROP TRIGGER IF EXISTS trg_coin_award_setting_audit_immutable_update;
DROP TRIGGER IF EXISTS trg_coin_award_setting_audit_immutable_delete;
DROP TRIGGER IF EXISTS trg_coin_award_batches_immutable_update;
DROP TRIGGER IF EXISTS trg_coin_award_batches_immutable_delete;

DROP INDEX IF EXISTS idx_coin_award_setting_audit_scope_created;
DROP INDEX IF EXISTS idx_coin_award_batches_parent;
DROP INDEX IF EXISTS idx_coin_award_batches_class_created;
DROP INDEX IF EXISTS idx_coin_award_batches_actor_date_created;

DROP TABLE IF EXISTS coin_award_setting_audit;
DROP TABLE IF EXISTS coin_award_batches;
DROP TABLE IF EXISTS coin_award_settings;

DELETE FROM feature_flag_rules WHERE flag_key = 'student_coin_awards_v1';
DELETE FROM feature_flags WHERE flag_key = 'student_coin_awards_v1';
