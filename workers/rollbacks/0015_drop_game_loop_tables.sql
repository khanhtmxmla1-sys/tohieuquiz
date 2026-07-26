-- Rollback for 0015_add_game_loop_tables.sql
-- Destructive: every gamification streak, mission claim, achievement unlock and
-- reward event is removed. Export these tables before running this in production.

DROP INDEX IF EXISTS idx_game_activity_events_user_date;
DROP INDEX IF EXISTS idx_game_reward_events_user_date;
DROP INDEX IF EXISTS idx_game_achievement_user_code;

DROP TABLE IF EXISTS student_game_activity_events;
DROP TABLE IF EXISTS student_reward_events;
DROP TABLE IF EXISTS student_achievement_unlocks;
DROP TABLE IF EXISTS student_daily_progress;
DROP TABLE IF EXISTS student_game_profiles;
