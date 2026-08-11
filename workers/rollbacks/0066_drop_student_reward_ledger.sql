-- Roll back canonical student reward ledger structures.
-- WARNING: reward ledger entries created after migration 0066 are discarded by this rollback.

DROP VIEW IF EXISTS student_reward_reconciliation;
DROP TRIGGER IF EXISTS trg_gift_wallet_to_student_reward_ledger;
DROP TRIGGER IF EXISTS trg_student_reward_ledger_nonnegative_wallet;
DROP TRIGGER IF EXISTS trg_student_reward_ledger_immutable_update;
DROP TRIGGER IF EXISTS trg_student_reward_ledger_immutable_delete;
DROP TABLE IF EXISTS student_weekly_state;
DROP TABLE IF EXISTS student_weekly_subjects;
DROP TABLE IF EXISTS student_reward_ledger;
ALTER TABLE user_pets DROP COLUMN total_exp;
