-- Math format versioning, bulk repair rollback history, and privacy-safe render telemetry.

ALTER TABLE questions ADD COLUMN math_format_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_questions_math_format_version
    ON questions(math_format_version);

CREATE TABLE IF NOT EXISTS question_math_repairs (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    quiz_id TEXT NOT NULL,
    before_payload TEXT NOT NULL,
    after_payload TEXT NOT NULL,
    previous_version INTEGER NOT NULL DEFAULT 1,
    new_version INTEGER NOT NULL DEFAULT 2,
    repaired_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    rolled_back_at TEXT,
    rolled_back_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_question_math_repairs_batch
    ON question_math_repairs(batch_id, rolled_back_at);
CREATE INDEX IF NOT EXISTS idx_question_math_repairs_question
    ON question_math_repairs(question_id, created_at DESC);

CREATE TABLE IF NOT EXISTS math_render_events (
    fingerprint TEXT PRIMARY KEY,
    quiz_id TEXT,
    question_id TEXT,
    question_type TEXT,
    error_code TEXT NOT NULL,
    route TEXT,
    math_format_version INTEGER NOT NULL DEFAULT 1,
    count INTEGER NOT NULL DEFAULT 1,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_math_render_events_last_seen
    ON math_render_events(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_math_render_events_quiz
    ON math_render_events(quiz_id, last_seen_at DESC);
