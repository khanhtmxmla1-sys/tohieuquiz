-- Roll back only resources introduced by migration 0060.
-- The legacy test_bank table and all of its rows are intentionally retained.

DELETE FROM feature_flag_rules WHERE flag_key = 'system_question_bank_v1';
DELETE FROM feature_flags WHERE flag_key = 'system_question_bank_v1';

DROP INDEX IF EXISTS idx_question_bank_audit_actor_created;
DROP INDEX IF EXISTS idx_question_bank_audit_item_created;
DROP TABLE IF EXISTS question_bank_audit;

DROP INDEX IF EXISTS idx_question_bank_type_difficulty;
DROP INDEX IF EXISTS idx_question_bank_owner;
DROP INDEX IF EXISTS idx_question_bank_browse;
DROP INDEX IF EXISTS idx_question_bank_unique_content;
DROP TABLE IF EXISTS question_bank_items;
