-- Roll back Competition V1 core only. Drop in reverse dependency order.
DROP TABLE IF EXISTS competition_eligibility;
DROP TABLE IF EXISTS competition_round_progress;
DROP TABLE IF EXISTS competition_round_attempts;
DROP TABLE IF EXISTS competition_round_quizzes;
DROP TABLE IF EXISTS competition_rounds;
DROP TABLE IF EXISTS competition_quiz_snapshots;
DROP TABLE IF EXISTS competition_audience_members;
DROP TABLE IF EXISTS competition_audience_snapshots;
DROP TABLE IF EXISTS competition_campaigns;
