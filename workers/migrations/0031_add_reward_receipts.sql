CREATE TABLE IF NOT EXISTS reward_receipts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  reward_exp INTEGER NOT NULL DEFAULT 0,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  new_level INTEGER NOT NULL DEFAULT 1,
  new_exp INTEGER NOT NULL DEFAULT 0,
  new_exp_to_next INTEGER NOT NULL DEFAULT 100,
  new_coins INTEGER NOT NULL DEFAULT 0,
  leveled_up INTEGER NOT NULL DEFAULT 0,
  mood TEXT NOT NULL DEFAULT 'excited',
  created_at TEXT NOT NULL,
  UNIQUE (username, activity_type, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_reward_receipts_activity
  ON reward_receipts (activity_type, activity_id);
