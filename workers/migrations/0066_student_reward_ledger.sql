-- Canonical immutable reward ledger and server-derived weekly progress foundations.
-- Existing balances are preserved as opening entries; legacy receipts are zero-delta locks.

CREATE TABLE IF NOT EXISTS student_reward_ledger (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  coins_delta INTEGER NOT NULL DEFAULT 0,
  exp_delta INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(student_id, source_type, source_key),
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_student_reward_ledger_student_created
  ON student_reward_ledger(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_reward_ledger_source
  ON student_reward_ledger(source_type, source_key);

CREATE TRIGGER IF NOT EXISTS trg_student_reward_ledger_nonnegative_wallet
BEFORE INSERT ON student_reward_ledger
WHEN NEW.coins_delta < 0
  AND COALESCE((SELECT coins FROM students WHERE id = NEW.student_id), 0) + NEW.coins_delta < 0
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_COIN_BALANCE');
END;

CREATE TRIGGER IF NOT EXISTS trg_student_reward_ledger_immutable_update
BEFORE UPDATE ON student_reward_ledger
BEGIN
  SELECT RAISE(ABORT, 'REWARD_LEDGER_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_student_reward_ledger_immutable_delete
BEFORE DELETE ON student_reward_ledger
BEGIN
  SELECT RAISE(ABORT, 'REWARD_LEDGER_IMMUTABLE');
END;

ALTER TABLE user_pets ADD COLUMN total_exp INTEGER NOT NULL DEFAULT 0;

-- Level N starts after 10*(N-1)^2 + 90*(N-1) cumulative EXP.
UPDATE user_pets
SET total_exp = MAX(
  0,
  10 * (MAX(COALESCE(level, 1), 1) - 1) * (MAX(COALESCE(level, 1), 1) - 1)
    + 90 * (MAX(COALESCE(level, 1), 1) - 1)
    + MAX(COALESCE(exp, 0), 0)
);

-- These two tables existed in schema.sql but had no forward migration.
CREATE TABLE IF NOT EXISTS leaderboard_rewards_history (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  period TEXT NOT NULL,
  period_key TEXT NOT NULL,
  rank INTEGER NOT NULL,
  coins_awarded INTEGER DEFAULT 0,
  badge_code TEXT,
  awarded_at TEXT NOT NULL,
  FOREIGN KEY(username) REFERENCES students(username)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rewards_user
  ON leaderboard_rewards_history(username, awarded_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rewards_period
  ON leaderboard_rewards_history(period, period_key);

CREATE TABLE IF NOT EXISTS student_weekly_progress (
  username TEXT NOT NULL,
  week_key TEXT NOT NULL,
  quest_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  target INTEGER NOT NULL,
  claimed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(username, week_key, quest_id),
  FOREIGN KEY(username) REFERENCES students(username)
);
CREATE INDEX IF NOT EXISTS idx_weekly_progress_user_week
  ON student_weekly_progress(username, week_key);
CREATE INDEX IF NOT EXISTS idx_weekly_progress_quest
  ON student_weekly_progress(quest_id, week_key);

CREATE TABLE IF NOT EXISTS student_weekly_subjects (
  username TEXT NOT NULL,
  week_key TEXT NOT NULL,
  subject_key TEXT NOT NULL CHECK(subject_key IN ('toan', 'tieng-viet', 'tieng-anh')),
  first_result_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(username, week_key, subject_key),
  FOREIGN KEY(username) REFERENCES students(username)
);

CREATE TABLE IF NOT EXISTS student_weekly_state (
  username TEXT NOT NULL,
  week_key TEXT NOT NULL,
  current_perfect_streak INTEGER NOT NULL DEFAULT 0,
  max_perfect_streak INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(username, week_key),
  FOREIGN KEY(username) REFERENCES students(username)
);

-- Preserve the current wallet exactly once as the reconciliation opening balance.
INSERT OR IGNORE INTO student_reward_ledger (
  id, student_id, source_type, source_key, reward_type,
  coins_delta, exp_delta, payload_json, created_at
)
SELECT
  'reward-opening-' || s.id,
  s.id,
  'BALANCE_OPENING',
  '0066',
  'COINS',
  COALESCE(s.coins, 0),
  0,
  json_object('migration', '0066_student_reward_ledger'),
  datetime('now')
FROM students s;

-- Existing result reward receipts already affected balances. Lock replays with delta 0.
INSERT OR IGNORE INTO student_reward_ledger (
  id, student_id, source_type, source_key, reward_type,
  coins_delta, exp_delta, payload_json, created_at
)
SELECT
  'reward-legacy-result-' || rr.id,
  s.id,
  'QUIZ_RESULT',
  rr.activity_id,
  'COINS_EXP',
  0,
  0,
  json_object(
    'legacyReceiptId', rr.id,
    'historicalCoins', rr.reward_coins,
    'historicalExp', rr.reward_exp,
    'backfilled', 1
  ),
  rr.created_at
FROM reward_receipts rr
JOIN students s ON s.username = rr.username
WHERE rr.activity_type = 'QUIZ_RESULT';

INSERT OR IGNORE INTO student_reward_ledger (
  id, student_id, source_type, source_key, reward_type,
  coins_delta, exp_delta, payload_json, created_at
)
SELECT
  'reward-legacy-attendance-' || ac.id,
  s.id,
  'DAILY_ATTENDANCE',
  ac.claim_date,
  'COINS_EXP',
  0,
  0,
  json_object(
    'legacyClaimId', ac.id,
    'historicalCoins', ac.reward_coins,
    'historicalExp', ac.reward_exp,
    'backfilled', 1
  ),
  ac.created_at
FROM attendance_claims ac
JOIN students s ON s.username = ac.username;

INSERT OR IGNORE INTO student_reward_ledger (
  id, student_id, source_type, source_key, reward_type,
  coins_delta, exp_delta, payload_json, created_at
)
SELECT
  'reward-legacy-dm-q-' || s.id || '-' || p.progress_date,
  s.id, 'DAILY_MISSION', p.progress_date || ':daily_questions', 'COINS',
  0, 0, json_object('missionId', 'daily_questions', 'backfilled', 1), datetime('now')
FROM student_daily_progress p
JOIN students s ON s.username = p.username
WHERE COALESCE(p.mission_questions_claimed, 0) = 1;

INSERT OR IGNORE INTO student_reward_ledger (
  id, student_id, source_type, source_key, reward_type,
  coins_delta, exp_delta, payload_json, created_at
)
SELECT
  'reward-legacy-dm-a-' || s.id || '-' || p.progress_date,
  s.id, 'DAILY_MISSION', p.progress_date || ':daily_accuracy', 'COINS',
  0, 0, json_object('missionId', 'daily_accuracy', 'backfilled', 1), datetime('now')
FROM student_daily_progress p
JOIN students s ON s.username = p.username
WHERE COALESCE(p.mission_accuracy_claimed, 0) = 1;

INSERT OR IGNORE INTO student_reward_ledger (
  id, student_id, source_type, source_key, reward_type,
  coins_delta, exp_delta, payload_json, created_at
)
SELECT
  'reward-legacy-dm-s-' || s.id || '-' || p.progress_date,
  s.id, 'DAILY_MISSION', p.progress_date || ':daily_subject', 'COINS',
  0, 0, json_object('missionId', 'daily_subject', 'backfilled', 1), datetime('now')
FROM student_daily_progress p
JOIN students s ON s.username = p.username
WHERE COALESCE(p.mission_subject_claimed, 0) = 1;

INSERT OR IGNORE INTO student_reward_ledger (
  id, student_id, source_type, source_key, reward_type,
  coins_delta, exp_delta, payload_json, created_at
)
SELECT
  'reward-legacy-chest-' || s.id || '-' || p.progress_date,
  s.id, 'DAILY_CHEST', p.progress_date, 'LEGACY',
  0, 0, json_object('backfilled', 1), datetime('now')
FROM student_daily_progress p
JOIN students s ON s.username = p.username
WHERE COALESCE(p.chest_claimed, 0) = 1;

INSERT OR IGNORE INTO student_reward_ledger (
  id, student_id, source_type, source_key, reward_type,
  coins_delta, exp_delta, payload_json, created_at
)
SELECT
  'reward-legacy-weekly-' || s.id || '-' || wp.week_key || '-' || wp.quest_id,
  s.id, 'WEEKLY_QUEST', wp.week_key || ':' || wp.quest_id, 'LEGACY',
  0, 0, json_object('questId', wp.quest_id, 'backfilled', 1), wp.updated_at
FROM student_weekly_progress wp
JOIN students s ON s.username = wp.username
WHERE COALESCE(wp.claimed, 0) = 1;

INSERT OR IGNORE INTO student_reward_ledger (
  id, student_id, source_type, source_key, reward_type,
  coins_delta, exp_delta, payload_json, created_at
)
SELECT
  'reward-legacy-leaderboard-' || lr.id,
  s.id, 'WEEKLY_LEADERBOARD', lr.period_key, 'COINS',
  0, 0,
  json_object('rank', lr.rank, 'historicalCoins', lr.coins_awarded, 'backfilled', 1),
  lr.awarded_at
FROM leaderboard_rewards_history lr
JOIN students s ON s.username = lr.username
WHERE lr.period = 'weekly';

INSERT OR IGNORE INTO student_reward_ledger (
  id, student_id, source_type, source_key, reward_type,
  coins_delta, exp_delta, payload_json, created_at
)
SELECT
  'reward-legacy-gift-' || gw.id,
  gw.student_id,
  CASE WHEN gw.reason = 'REFUND' THEN 'GIFT_REFUND' ELSE 'GIFT_PURCHASE' END,
  gw.ref_order_id,
  'COINS',
  0,
  0,
  json_object('legacyGiftLedgerId', gw.id, 'historicalDelta', gw.delta_coins, 'backfilled', 1),
  gw.created_at
FROM gift_wallet_ledger gw
WHERE gw.reason IN ('PURCHASE', 'REFUND')
  AND COALESCE(gw.ref_order_id, '') <> '';

-- Future gift-shop wallet movements remain compatible and are mirrored atomically.
CREATE TRIGGER IF NOT EXISTS trg_gift_wallet_to_student_reward_ledger
AFTER INSERT ON gift_wallet_ledger
WHEN NEW.reason IN ('PURCHASE', 'REFUND') AND COALESCE(NEW.ref_order_id, '') <> ''
BEGIN
  INSERT INTO student_reward_ledger (
    id, student_id, source_type, source_key, reward_type,
    coins_delta, exp_delta, payload_json, created_at
  ) VALUES (
    'reward-gift-' || NEW.id,
    NEW.student_id,
    CASE WHEN NEW.reason = 'REFUND' THEN 'GIFT_REFUND' ELSE 'GIFT_PURCHASE' END,
    NEW.ref_order_id,
    'COINS',
    NEW.delta_coins,
    0,
    json_object('giftLedgerId', NEW.id, 'reason', NEW.reason),
    NEW.created_at
  );
END;

CREATE VIEW IF NOT EXISTS student_reward_reconciliation AS
SELECT
  s.id AS student_id,
  s.username AS username,
  COALESCE(s.coins, 0) AS wallet_coins,
  COALESCE(SUM(l.coins_delta), 0) AS ledger_coins,
  COALESCE(s.coins, 0) - COALESCE(SUM(l.coins_delta), 0) AS difference
FROM students s
LEFT JOIN student_reward_ledger l ON l.student_id = s.id
GROUP BY s.id, s.username, s.coins;
