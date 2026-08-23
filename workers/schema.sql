-- TôHiệuQuiz D1 Schema
-- Migrated from Google Sheets

-- Teachers
CREATE TABLE IF NOT EXISTS teachers (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher',
  class TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
  token_version INTEGER NOT NULL DEFAULT 1,
  password_changed_at TEXT,
  last_login_at TEXT,
  disabled_at TEXT,
  disabled_by TEXT,
  disabled_reason TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_teachers_status_role ON teachers(status, role, username);

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  teacher_username TEXT NOT NULL,
  created_at TEXT NOT NULL,
  archived_at TEXT
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  class_id TEXT NOT NULL,
  parent_phone TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  coins INTEGER DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  token_version INTEGER NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'session' CHECK (purpose IN ('session', 'password_change')),
  user_agent_family TEXT NOT NULL DEFAULT 'Other',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_reason TEXT,
  revoked_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_created
  ON auth_sessions(username, role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_expiry
  ON auth_sessions(username, role, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_retention
  ON auth_sessions(created_at);

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'LOGIN_FAILURE_THRESHOLD', 'PASSWORD_CHANGED', 'PASSWORD_RESET',
    'SESSION_REVOKED', 'SESSIONS_REVOKED_ALL', 'PASSKEY_ADDED', 'PASSKEY_REMOVED'
  )),
  severity TEXT NOT NULL DEFAULT 'informational'
    CHECK (severity IN ('informational', 'action_required', 'critical')),
  actor_username TEXT,
  session_id TEXT,
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_events_user_created
  ON security_events(username, role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type_created
  ON security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_retention
  ON security_events(created_at);


CREATE TABLE IF NOT EXISTS webauthn_credentials (
  credential_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'admin')),
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0 CHECK (counter >= 0),
  transports_json TEXT NOT NULL DEFAULT '[]',
  device_type TEXT NOT NULL,
  backed_up INTEGER NOT NULL DEFAULT 0 CHECK (backed_up IN (0, 1)),
  label TEXT NOT NULL DEFAULT 'Passkey',
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  revoked_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_created
  ON webauthn_credentials(username, role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_active
  ON webauthn_credentials(username, role, revoked_at);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'admin')),
  purpose TEXT NOT NULL CHECK (purpose IN ('registration', 'authentication')),
  challenge_hash TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_owner_expiry
  ON webauthn_challenges(username, role, purpose, expires_at);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_retention
  ON webauthn_challenges(created_at);

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  class_level TEXT NOT NULL,
  category TEXT DEFAULT '',
  time_limit INTEGER DEFAULT 60,
  created_at TEXT NOT NULL,
  access_code TEXT DEFAULT '',
  require_code TEXT DEFAULT 'FALSE',
  created_by TEXT DEFAULT '',
  show_on_home TEXT DEFAULT 'TRUE',
  tags TEXT DEFAULT '[]',
  source_type TEXT NOT NULL DEFAULT 'manual',
  parent_quiz_id TEXT,
  version_number INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);
CREATE INDEX IF NOT EXISTS idx_quizzes_parent_version ON quizzes(parent_quiz_id, version_number);
CREATE INDEX IF NOT EXISTS idx_quizzes_source_type ON quizzes(source_type);

-- Teacher-owned manual quiz drafts with optimistic revision control
CREATE TABLE IF NOT EXISTS quiz_drafts (
  id TEXT PRIMARY KEY,
  owner_username TEXT NOT NULL,
  quiz_id TEXT,
  draft_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_quiz_drafts_owner_updated
  ON quiz_drafts(owner_username, updated_at DESC);

-- Questions (flexible schema to handle 14+ question types)
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  type TEXT NOT NULL,
  question TEXT DEFAULT '',
  question_rich_text TEXT NOT NULL DEFAULT '',
  options TEXT DEFAULT '',
  correct_answer TEXT DEFAULT '',
  items TEXT DEFAULT '',
  text_field TEXT DEFAULT '',
  blanks TEXT DEFAULT '',
  distractors TEXT DEFAULT '',
  sentence TEXT DEFAULT '',
  words TEXT DEFAULT '',
  correct_word_indexes TEXT DEFAULT '',
  image TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  skill_code TEXT DEFAULT '',
  subskill_code TEXT DEFAULT '',
  difficulty INTEGER DEFAULT NULL,
  math_format_version INTEGER NOT NULL DEFAULT 1,
  points REAL,
  explanation TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  svg_content TEXT NOT NULL DEFAULT '',
  svg_alt TEXT NOT NULL DEFAULT '',
  answer_schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_questions_tags ON questions(tags);

-- Results
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT,
  assignment_id TEXT,
  class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  class_name TEXT DEFAULT '',
  quiz_id TEXT DEFAULT '',
  quiz_title TEXT DEFAULT '',
  score REAL DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  time_taken INTEGER DEFAULT 0,
  submitted_at TEXT NOT NULL,
  answers TEXT DEFAULT '{}',
  analytics_json TEXT DEFAULT '[]',
  grading_version TEXT NOT NULL DEFAULT 'legacy'
);

-- Assignments
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  student_id TEXT DEFAULT '',
  deadline TEXT NOT NULL,
  max_attempts INTEGER DEFAULT 1,
  intervention_group_id TEXT,
  status TEXT DEFAULT 'OPEN',
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT,
  revoked_reason TEXT,
  previous_status TEXT,
  submission_count_at_revoke INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_results_assignment_student
  ON results(assignment_id, student_id, submitted_at);

CREATE INDEX IF NOT EXISTS idx_results_class_submitted
  ON results(class_id, submitted_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_results_class_quiz_submitted
  ON results(class_id, quiz_id, submitted_at DESC, id DESC);

-- User Pets (Gamification)
CREATE TABLE IF NOT EXISTS user_pets (
  username TEXT PRIMARY KEY,
  pet_id TEXT DEFAULT 'cat_01',
  pet_name TEXT DEFAULT 'Mèo Con',
  level INTEGER DEFAULT 1,
  exp INTEGER DEFAULT 0,
  exp_to_next INTEGER DEFAULT 100,
  total_exp INTEGER NOT NULL DEFAULT 0,
  mood TEXT DEFAULT 'happy',
  items TEXT DEFAULT '[]',
  image_url TEXT DEFAULT '',
  last_active TEXT DEFAULT ''
);

-- Daily attendance claims (server-side anti-duplicate)
CREATE TABLE IF NOT EXISTS attendance_claims (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  claim_date TEXT NOT NULL,
  reward_exp INTEGER NOT NULL,
  reward_coins INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Shop Items
CREATE TABLE IF NOT EXISTS shop_items (
  item_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER DEFAULT 0,
  type TEXT DEFAULT 'ACCESSORY',
  category TEXT DEFAULT '',
  asset_url TEXT DEFAULT ''
);

-- Gift Shop Catalog (real-world reward catalog)
CREATE TABLE IF NOT EXISTS gift_catalog_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_coins INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  stock_total INTEGER NOT NULL DEFAULT 100,
  stock_remaining INTEGER NOT NULL DEFAULT 100,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  weekly_limit_per_student INTEGER NOT NULL DEFAULT 1,
  scope_type TEXT NOT NULL DEFAULT 'SCHOOL',
  school_id TEXT NOT NULL DEFAULT '',
  class_id TEXT,
  grade_level INTEGER,
  created_by TEXT NOT NULL DEFAULT ''
);

-- Gift Shop Orders
CREATE TABLE IF NOT EXISTS gift_orders (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  item_id TEXT NOT NULL DEFAULT '',
  school_id TEXT NOT NULL DEFAULT '',
  grade_level INTEGER,
  week_key TEXT NOT NULL DEFAULT '',
  item_snapshot TEXT NOT NULL,
  price_coins INTEGER NOT NULL,
  status TEXT NOT NULL,
  voucher_code TEXT NOT NULL,
  approved_by TEXT NOT NULL DEFAULT '',
  approved_at TEXT NOT NULL DEFAULT '',
  delivered_by TEXT DEFAULT '',
  delivered_at TEXT DEFAULT '',
  cancelled_by TEXT NOT NULL DEFAULT '',
  cancelled_at TEXT NOT NULL DEFAULT '',
  cancel_reason TEXT DEFAULT '',
  transition_actor TEXT NOT NULL DEFAULT '',
  transition_request_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Gift vouchers
CREATE TABLE IF NOT EXISTS gift_vouchers (
  code TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  student_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  status TEXT NOT NULL
);

-- Gift wallet ledger
CREATE TABLE IF NOT EXISTS gift_wallet_ledger (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  delta_coins INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_order_id TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

-- Canonical immutable student reward ledger.
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

-- Gift shop audit events
CREATE TABLE IF NOT EXISTS gift_order_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id TEXT DEFAULT '',
  student_id TEXT DEFAULT '',
  actor TEXT DEFAULT '',
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  request_id TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS gift_shop_scope_settings (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('SCHOOL', 'CLASS')),
  school_id TEXT NOT NULL,
  class_id TEXT NOT NULL DEFAULT '',
  is_open INTEGER NOT NULL DEFAULT 1 CHECK(is_open IN (0, 1)),
  closed_reason TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(scope_type, school_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_gift_catalog_scope_stock
  ON gift_catalog_items(is_active, school_id, scope_type, class_id, grade_level, stock_remaining);
CREATE INDEX IF NOT EXISTS idx_gift_orders_student_item_week
  ON gift_orders(student_id, item_id, week_key, status);
CREATE INDEX IF NOT EXISTS idx_gift_scope_settings_lookup
  ON gift_shop_scope_settings(school_id, class_id, is_open);
CREATE INDEX IF NOT EXISTS idx_gift_events_request
  ON gift_order_events(request_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_gift_order_purchase_guard;
CREATE TRIGGER trg_gift_order_purchase_guard
BEFORE INSERT ON gift_orders
WHEN NEW.status = 'PENDING'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM gift_catalog_items item
    WHERE item.id = NEW.item_id AND item.is_active = 1
  ) THEN RAISE(ABORT, 'GIFT_ITEM_UNAVAILABLE') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM students student
    WHERE student.id = NEW.student_id
      AND student.class_id = NEW.class_id
      AND COALESCE(student.archived_at, '') = ''
  ) THEN RAISE(ABORT, 'GIFT_STUDENT_SCOPE') END;

  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM gift_catalog_items item
    JOIN students student ON student.id = NEW.student_id AND student.class_id = NEW.class_id
    JOIN classes classroom ON classroom.id = student.class_id AND COALESCE(classroom.archived_at, '') = ''
    WHERE item.id = NEW.item_id
      AND (item.school_id = '' OR item.school_id = classroom.teacher_username)
      AND (
        item.scope_type = 'SCHOOL'
        OR (item.scope_type = 'CLASS' AND COALESCE(item.class_id, '') = student.class_id)
        OR (item.scope_type = 'GRADE' AND item.grade_level = CAST(substr(classroom.name, 1, 1) AS INTEGER))
      )
  ) THEN RAISE(ABORT, 'GIFT_SCOPE_FORBIDDEN') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM gift_shop_scope_settings setting
    WHERE setting.is_open = 0
      AND setting.school_id = NEW.school_id
      AND (
        setting.scope_type = 'SCHOOL'
        OR (setting.scope_type = 'CLASS' AND setting.class_id = NEW.class_id)
      )
  ) THEN RAISE(ABORT, 'GIFT_SHOP_CLOSED') END;

  SELECT CASE WHEN (
    SELECT stock_remaining FROM gift_catalog_items WHERE id = NEW.item_id
  ) <= 0 THEN RAISE(ABORT, 'GIFT_OUT_OF_STOCK') END;

  SELECT CASE WHEN NEW.price_coins <> (
    SELECT price_coins FROM gift_catalog_items WHERE id = NEW.item_id
  ) THEN RAISE(ABORT, 'GIFT_PRICE_MISMATCH') END;

  SELECT CASE WHEN (
    SELECT coins FROM students WHERE id = NEW.student_id
  ) < NEW.price_coins THEN RAISE(ABORT, 'GIFT_INSUFFICIENT_COINS') END;

  SELECT CASE WHEN (
    SELECT weekly_limit_per_student FROM gift_catalog_items WHERE id = NEW.item_id
  ) > 0 AND (
    SELECT COUNT(*)
    FROM gift_orders prior
    WHERE prior.student_id = NEW.student_id
      AND prior.item_id = NEW.item_id
      AND prior.week_key = NEW.week_key
      AND prior.status IN ('PENDING', 'APPROVED', 'DELIVERED')
  ) >= (
    SELECT weekly_limit_per_student FROM gift_catalog_items WHERE id = NEW.item_id
  ) THEN RAISE(ABORT, 'GIFT_WEEKLY_LIMIT') END;
END;

DROP TRIGGER IF EXISTS trg_gift_order_purchase_commit;
CREATE TRIGGER trg_gift_order_purchase_commit
AFTER INSERT ON gift_orders
WHEN NEW.status = 'PENDING'
BEGIN
  UPDATE students
  SET coins = coins - NEW.price_coins
  WHERE id = NEW.student_id AND coins >= NEW.price_coins;

  UPDATE gift_catalog_items
  SET stock_remaining = stock_remaining - 1,
      updated_at = NEW.updated_at
  WHERE id = NEW.item_id AND stock_remaining > 0;

  INSERT INTO gift_wallet_ledger
    (id, student_id, delta_coins, reason, ref_order_id, created_at)
  VALUES
    ('gled-' || lower(hex(randomblob(8))), NEW.student_id, -NEW.price_coins, 'PURCHASE', NEW.id, NEW.created_at);

  INSERT INTO gift_order_events
    (id, event_type, order_id, student_id, actor, metadata, created_at, request_id)
  VALUES
    ('gevo-' || lower(hex(randomblob(8))), 'ORDER_CREATED', NEW.id, NEW.student_id,
     NEW.transition_actor, json_object('itemId', NEW.item_id, 'priceCoins', NEW.price_coins),
     NEW.created_at, NEW.transition_request_id);
END;

DROP TRIGGER IF EXISTS trg_gift_order_transition_guard;
CREATE TRIGGER trg_gift_order_transition_guard
BEFORE UPDATE OF status ON gift_orders
WHEN NEW.status <> OLD.status
BEGIN
  SELECT CASE WHEN NOT (
    (OLD.status = 'PENDING' AND NEW.status IN ('APPROVED', 'CANCELLED'))
    OR (OLD.status = 'APPROVED' AND NEW.status IN ('DELIVERED', 'CANCELLED'))
  ) THEN RAISE(ABORT, 'GIFT_INVALID_TRANSITION') END;

  SELECT CASE WHEN TRIM(NEW.transition_actor) = '' OR TRIM(NEW.transition_request_id) = ''
    THEN RAISE(ABORT, 'GIFT_TRANSITION_AUDIT_REQUIRED') END;

  SELECT CASE WHEN NEW.status = 'APPROVED' AND TRIM(NEW.voucher_code) = ''
    THEN RAISE(ABORT, 'GIFT_VOUCHER_REQUIRED') END;

  SELECT CASE WHEN NEW.status = 'CANCELLED' AND TRIM(NEW.cancel_reason) = ''
    THEN RAISE(ABORT, 'GIFT_CANCEL_REASON_REQUIRED') END;
END;

DROP TRIGGER IF EXISTS trg_gift_order_approved;
CREATE TRIGGER trg_gift_order_approved
AFTER UPDATE OF status ON gift_orders
WHEN OLD.status = 'PENDING' AND NEW.status = 'APPROVED'
BEGIN
  INSERT INTO gift_vouchers (code, order_id, student_id, issued_at, status)
  VALUES (NEW.voucher_code, NEW.id, NEW.student_id, NEW.approved_at, 'ISSUED');

  INSERT INTO gift_order_events
    (id, event_type, order_id, student_id, actor, metadata, created_at, request_id)
  VALUES
    ('gevo-' || lower(hex(randomblob(8))), 'ORDER_APPROVED', NEW.id, NEW.student_id,
     NEW.transition_actor, json_object('voucherCode', NEW.voucher_code),
     NEW.approved_at, NEW.transition_request_id);
END;

DROP TRIGGER IF EXISTS trg_gift_order_delivered;
CREATE TRIGGER trg_gift_order_delivered
AFTER UPDATE OF status ON gift_orders
WHEN OLD.status = 'APPROVED' AND NEW.status = 'DELIVERED'
BEGIN
  UPDATE gift_vouchers SET status = 'USED' WHERE order_id = NEW.id;

  INSERT INTO gift_order_events
    (id, event_type, order_id, student_id, actor, metadata, created_at, request_id)
  VALUES
    ('gevo-' || lower(hex(randomblob(8))), 'ORDER_DELIVERED', NEW.id, NEW.student_id,
     NEW.transition_actor, '{}', NEW.delivered_at, NEW.transition_request_id);
END;

DROP TRIGGER IF EXISTS trg_gift_order_cancelled;
CREATE TRIGGER trg_gift_order_cancelled
AFTER UPDATE OF status ON gift_orders
WHEN OLD.status IN ('PENDING', 'APPROVED') AND NEW.status = 'CANCELLED'
BEGIN
  UPDATE students SET coins = coins + NEW.price_coins WHERE id = NEW.student_id;
  UPDATE gift_catalog_items
  SET stock_remaining = MIN(stock_total, stock_remaining + 1),
      updated_at = NEW.updated_at
  WHERE id = NEW.item_id;
  UPDATE gift_vouchers SET status = 'CANCELLED' WHERE order_id = NEW.id;

  INSERT INTO gift_wallet_ledger
    (id, student_id, delta_coins, reason, ref_order_id, created_at)
  VALUES
    ('gled-' || lower(hex(randomblob(8))), NEW.student_id, NEW.price_coins, 'REFUND', NEW.id, NEW.cancelled_at);

  INSERT INTO gift_order_events
    (id, event_type, order_id, student_id, actor, metadata, created_at, request_id)
  VALUES
    ('gevo-' || lower(hex(randomblob(8))), 'ORDER_CANCELLED', NEW.id, NEW.student_id,
     NEW.transition_actor, json_object('reason', NEW.cancel_reason),
     NEW.cancelled_at, NEW.transition_request_id);

  INSERT INTO gift_order_events
    (id, event_type, order_id, student_id, actor, metadata, created_at, request_id)
  VALUES
    ('gevo-' || lower(hex(randomblob(8))), 'WALLET_REFUNDED', NEW.id, NEW.student_id,
     NEW.transition_actor, json_object('amount', NEW.price_coins),
     NEW.cancelled_at, NEW.transition_request_id);
END;

-- Game loop profiles (missions, boosters, collections)
CREATE TABLE IF NOT EXISTS student_game_profiles (
  username TEXT PRIMARY KEY,
  daily_streak INTEGER NOT NULL DEFAULT 0,
  last_mission_completion_date TEXT DEFAULT '',
  hint_tokens INTEGER NOT NULL DEFAULT 0,
  streak_shields INTEGER NOT NULL DEFAULT 0,
  collection_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Per-day mission progress
CREATE TABLE IF NOT EXISTS student_daily_progress (
  username TEXT NOT NULL,
  progress_date TEXT NOT NULL,
  questions_answered INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  quizzes_completed INTEGER NOT NULL DEFAULT 0,
  toan_quizzes_completed INTEGER NOT NULL DEFAULT 0,
  tieng_viet_quizzes_completed INTEGER NOT NULL DEFAULT 0,
  mission_questions_claimed INTEGER NOT NULL DEFAULT 0,
  mission_accuracy_claimed INTEGER NOT NULL DEFAULT 0,
  mission_subject_claimed INTEGER NOT NULL DEFAULT 0,
  chest_claimed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (username, progress_date)
);

-- Achievement unlocks
CREATE TABLE IF NOT EXISTS student_achievement_unlocks (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  achievement_code TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}'
);

-- Mission and chest reward event log
CREATE TABLE IF NOT EXISTS student_reward_events (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

-- Activity events for idempotent mission progress tracking
CREATE TABLE IF NOT EXISTS student_game_activity_events (
  activity_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

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
  ON reward_receipts(activity_type, activity_id);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY DEFAULT '1',
  content TEXT DEFAULT '',
  is_active TEXT DEFAULT 'false',
  updated_at TEXT DEFAULT '',
  banner_title TEXT DEFAULT '',
  banner_subtitle TEXT DEFAULT '',
  banner_link TEXT DEFAULT '',
  banner_image TEXT DEFAULT '',
  is_banner_active TEXT DEFAULT 'false',
  days_to_live INTEGER DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED')),
  audience TEXT NOT NULL DEFAULT 'ALL' CHECK (audience IN ('ALL', 'TEACHERS', 'STUDENTS')),
  starts_at TEXT,
  ends_at TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT,
  priority TEXT NOT NULL DEFAULT 'INFO'
    CHECK (priority IN ('INFO', 'REMINDER', 'IMPORTANT', 'URGENT')),
  channels_json TEXT NOT NULL DEFAULT '["TICKER"]',
  dismissible INTEGER NOT NULL DEFAULT 1 CHECK (dismissible IN (0, 1)),
  cta_label TEXT,
  surface_overrides_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_announcements_delivery ON announcements(status, audience, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_created
  ON admin_audit_logs(actor_username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_created
  ON admin_audit_logs(target_type, target_id, created_at DESC);

-- System settings (global toggles)
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Login page media settings and Cloudinary slide metadata.
CREATE TABLE IF NOT EXISTS login_media_settings (
  id TEXT PRIMARY KEY,
  display_mode TEXT NOT NULL DEFAULT 'CONTENT'
    CHECK (display_mode IN ('CONTENT', 'SLIDER')),
  autoplay INTEGER NOT NULL DEFAULT 1 CHECK (autoplay IN (0, 1)),
  interval_ms INTEGER NOT NULL DEFAULT 5000 CHECK (interval_ms BETWEEN 2000 AND 30000),
  transition TEXT NOT NULL DEFAULT 'FADE'
    CHECK (transition IN ('FADE', 'SLIDE')),
  show_dots INTEGER NOT NULL DEFAULT 1 CHECK (show_dots IN (0, 1)),
  show_arrows INTEGER NOT NULL DEFAULT 1 CHECK (show_arrows IN (0, 1)),
  pause_on_hover INTEGER NOT NULL DEFAULT 1 CHECK (pause_on_hover IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

INSERT OR IGNORE INTO login_media_settings (
  id, display_mode, autoplay, interval_ms, transition,
  show_dots, show_arrows, pause_on_hover, version, updated_at, updated_by
) VALUES (
  'default', 'CONTENT', 1, 5000, 'FADE',
  1, 1, 1, 1, datetime('now'), NULL
);

CREATE TABLE IF NOT EXISTS login_media_slides (
  id TEXT PRIMARY KEY,
  cloudinary_public_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_width INTEGER CHECK (image_width IS NULL OR image_width > 0),
  image_height INTEGER CHECK (image_height IS NULL OR image_height > 0),
  alt_text TEXT NOT NULL DEFAULT '',
  internal_title TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  open_new_tab INTEGER NOT NULL DEFAULT 0 CHECK (open_new_tab IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_login_media_slides_active_order
  ON login_media_slides(enabled, sort_order, starts_at, ends_at);

-- Runtime feature rollout control plane.
CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  owner TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feature_flag_rules (
  flag_key TEXT PRIMARY KEY,
  audience TEXT NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all', 'admin', 'teacher', 'student', 'parent')),
  percentage INTEGER NOT NULL DEFAULT 100 CHECK (percentage BETWEEN 0 AND 100),
  allow_users_json TEXT NOT NULL DEFAULT '[]',
  allow_classes_json TEXT NOT NULL DEFAULT '[]',
  starts_at TEXT,
  ends_at TEXT,
  stop_conditions_json TEXT NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (flag_key) REFERENCES feature_flags(flag_key) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS feature_flag_audit (
  id TEXT PRIMARY KEY,
  flag_key TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('UPDATED', 'ROLLED_BACK')),
  field_name TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  request_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (flag_key) REFERENCES feature_flags(flag_key) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_flag_created
  ON feature_flag_audit(flag_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_actor_created
  ON feature_flag_audit(actor_username, created_at DESC);

-- Bộ đếm rate limit theo cửa sổ cố định (middleware/rateLimit.ts, utils/loginRateLimit.ts).
-- BẮT BUỘC phải có: các endpoint đăng nhập chạy limiter với failureMode 'closed', nên thiếu bảng
-- này là mọi lượt đăng nhập trả 503. Hình dạng bảng khớp ensureRateLimitTable() và migration 0043.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS teacher_ai_daily_usage (
  username TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (username, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_ai_daily_usage_date
  ON teacher_ai_daily_usage(usage_date);

CREATE TABLE IF NOT EXISTS ai_generation_actions (
  action_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  workflow TEXT NOT NULL CHECK(workflow IN ('QUIZ_CREATE', 'QUESTION_REGENERATE', 'GENERIC')),
  status TEXT NOT NULL CHECK(status IN ('RESERVED', 'SUCCEEDED', 'FAILED', 'EXPIRED')),
  usage_date TEXT NOT NULL,
  upstream_calls INTEGER NOT NULL DEFAULT 0 CHECK(upstream_calls >= 0),
  ocr_calls INTEGER NOT NULL DEFAULT 0 CHECK(ocr_calls >= 0),
  generate_calls INTEGER NOT NULL DEFAULT 0 CHECK(generate_calls >= 0),
  review_calls INTEGER NOT NULL DEFAULT 0 CHECK(review_calls >= 0),
  repair_calls INTEGER NOT NULL DEFAULT 0 CHECK(repair_calls >= 0),
  failure_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_actions_user_date
  ON ai_generation_actions(username, usage_date, status);
CREATE INDEX IF NOT EXISTS idx_ai_generation_actions_stale
  ON ai_generation_actions(status, updated_at);

-- RAG documents metadata
CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  source_path TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  checksum TEXT NOT NULL,
  chunk_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- RAG chunks (source of retrieval)
CREATE TABLE IF NOT EXISTS rag_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  section_title TEXT DEFAULT '',
  content TEXT NOT NULL,
  token_estimate INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- RAG full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
  chunk_id UNINDEXED,
  source_path,
  title,
  section_title,
  content,
  tokenize = 'unicode61'
);

-- RAG query logs (anonymous)
CREATE TABLE IF NOT EXISTS rag_query_logs (
  id TEXT PRIMARY KEY,
  session_hash TEXT DEFAULT '',
  question TEXT NOT NULL,
  top_k INTEGER DEFAULT 6,
  retrieved_count INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  fallback_reason TEXT DEFAULT '',
  include_sources INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_questions_math_format_version
  ON questions(math_format_version);
CREATE INDEX IF NOT EXISTS idx_math_render_events_last_seen
  ON math_render_events(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_math_render_events_quiz
  ON math_render_events(quiz_id, last_seen_at DESC);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_username ON students(username);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_quiz_id ON assignments(quiz_id);
CREATE INDEX IF NOT EXISTS idx_results_quiz_id ON results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_name);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_username);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_username ON classes(teacher_username, archived_at);
CREATE INDEX IF NOT EXISTS idx_classes_active_teacher ON classes(teacher_username, archived_at);
CREATE INDEX IF NOT EXISTS idx_students_active_class ON students(class_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_results_submitted_at ON results(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_analytics ON results(class_name, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_student_id_submitted ON results(student_id, submitted_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_claims(username, claim_date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_week ON attendance_claims(username, claim_date DESC);
CREATE INDEX IF NOT EXISTS idx_gift_catalog_active ON gift_catalog_items(is_active);
CREATE INDEX IF NOT EXISTS idx_gift_orders_status ON gift_orders(status);
CREATE INDEX IF NOT EXISTS idx_gift_orders_student ON gift_orders(student_id);
CREATE INDEX IF NOT EXISTS idx_gift_orders_class ON gift_orders(class_id);
CREATE INDEX IF NOT EXISTS idx_gift_orders_updated_at ON gift_orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_vouchers_order ON gift_vouchers(order_id);
CREATE INDEX IF NOT EXISTS idx_gift_ledger_student ON gift_wallet_ledger(student_id);
CREATE INDEX IF NOT EXISTS idx_gift_events_created_at ON gift_order_events(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_achievement_user_code ON student_achievement_unlocks(username, achievement_code);
CREATE INDEX IF NOT EXISTS idx_game_reward_events_user_date ON student_reward_events(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_activity_events_user_date ON student_game_activity_events(username, created_at DESC);
-- Runtime bootstrap aliases retained so fresh restores match production exactly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_achievement_user_code ON student_achievement_unlocks(username, achievement_code);
CREATE INDEX IF NOT EXISTS idx_reward_events_user_date ON student_reward_events(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_date ON student_game_activity_events(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_documents_source_path ON rag_documents(source_path);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_chunk_index ON rag_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS idx_rag_logs_created_at ON rag_query_logs(created_at DESC);

-- Live Exam sessions and polling state
CREATE TABLE IF NOT EXISTS live_exam_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  class_id TEXT,
  duration INTEGER NOT NULL,
  scheduled_at TEXT,
  started_at TEXT,
  ends_at TEXT,
  closed_at TEXT,
  paused_at TEXT,
  total_paused_seconds INTEGER NOT NULL DEFAULT 0,
  settings TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'scheduled',
  access_code TEXT NOT NULL UNIQUE,
  chat_enabled INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(username) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_access_code
  ON live_exam_sessions(access_code);
CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_status
  ON live_exam_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_teacher
  ON live_exam_sessions(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_class
  ON live_exam_sessions(class_id, status);
CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_teacher_archive_status
  ON live_exam_sessions(teacher_id, archived_at, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_access_active
  ON live_exam_sessions(access_code, archived_at, status);

CREATE TABLE IF NOT EXISTS live_exam_participants (
  id TEXT PRIMARY KEY,
  live_exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  username TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  started_at TEXT,
  submitted_at TEXT,
  individual_ends_at TEXT,
  answers TEXT,
  score INTEGER,
  correct_count INTEGER,
  wrong_count INTEGER,
  rank INTEGER,
  grading_version TEXT,
  tab_switches INTEGER DEFAULT 0,
  warnings TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(live_exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_live_exam_participants_session
  ON live_exam_participants(live_exam_id);
CREATE INDEX IF NOT EXISTS idx_live_exam_participants_student
  ON live_exam_participants(student_id);
CREATE INDEX IF NOT EXISTS idx_live_exam_participants_rank
  ON live_exam_participants(live_exam_id, rank);

CREATE TABLE IF NOT EXISTS live_exam_activity (
  live_exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  current_question INTEGER,
  answered_count INTEGER,
  last_activity TEXT NOT NULL,
  is_online INTEGER DEFAULT 1,
  PRIMARY KEY (live_exam_id, student_id),
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_exam_activity_session
  ON live_exam_activity(live_exam_id, is_online);

CREATE TABLE IF NOT EXISTS live_exam_answer_snapshots (
  live_exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  attempt_version INTEGER NOT NULL DEFAULT 0,
  answers TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (live_exam_id, student_id),
  UNIQUE (live_exam_id, student_id, idempotency_key),
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS live_exam_connection_events (
  id TEXT PRIMARY KEY,
  live_exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('online', 'reconnecting', 'offline', 'autosave', 'reconnected')),
  attempt_version INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_exam_connection_events_session_created
  ON live_exam_connection_events(live_exam_id, created_at DESC);

CREATE TABLE IF NOT EXISTS live_exam_control_confirmations (
  id TEXT PRIMARY KEY,
  live_exam_id TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action = 'end_early'),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_exam_control_confirmations_lookup
  ON live_exam_control_confirmations(live_exam_id, actor_username, action, expires_at);

CREATE TABLE IF NOT EXISTS live_exam_control_audit (
  id TEXT PRIMARY KEY,
  live_exam_id TEXT NOT NULL,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL,
  target_participant_id TEXT,
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (target_participant_id) REFERENCES live_exam_participants(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_live_exam_control_audit_session_created
  ON live_exam_control_audit(live_exam_id, created_at DESC);

CREATE TABLE IF NOT EXISTS live_exam_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  message_kind TEXT NOT NULL DEFAULT 'message',
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_exam_chat_session_created
  ON live_exam_chat_messages(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS live_exam_question_analytics (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  avg_time_seconds REAL,
  min_time_seconds REAL,
  max_time_seconds REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_exam_qa_session
  ON live_exam_question_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_live_exam_qa_session_question
  ON live_exam_question_analytics(session_id, question_index);

CREATE TABLE IF NOT EXISTS live_exam_student_timing (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  time_spent_seconds REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_id) REFERENCES live_exam_participants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_exam_timing_session
  ON live_exam_student_timing(session_id);
CREATE INDEX IF NOT EXISTS idx_live_exam_timing_participant
  ON live_exam_student_timing(participant_id);
CREATE INDEX IF NOT EXISTS idx_live_exam_timing_session_question
  ON live_exam_student_timing(session_id, question_index);

-- Homework Assignments (Teacher-created)
CREATE TABLE IF NOT EXISTS hw_assignments (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  deadline TEXT NOT NULL,
  class_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  file_url TEXT DEFAULT '',
  ai_content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED')),
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts BETWEEN 1 AND 10),
  published_at TEXT,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  source_ocr_text TEXT NOT NULL DEFAULT '',
  rubric_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

-- Homework Submissions (Student-submitted)
CREATE TABLE IF NOT EXISTS hw_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED, AI_REVIEW, GRADED
  file_urls TEXT DEFAULT '[]', -- JSON array of media links (R2/CDN; legacy Cloudinary URLs remain readable)
  student_note TEXT DEFAULT '',
  teacher_feedback TEXT DEFAULT '',
  ai_evaluation TEXT DEFAULT '',
  score REAL DEFAULT 0,
  submitted_at TEXT NOT NULL,
  analytics_json TEXT NOT NULL DEFAULT '[]',
  attempt_no INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT NOT NULL,
  ai_score REAL,
  ai_confidence REAL,
  ai_feedback TEXT NOT NULL DEFAULT '',
  grading_breakdown_json TEXT NOT NULL DEFAULT '[]',
  graded_by TEXT,
  graded_at TEXT,
  published_at TEXT,
  FOREIGN KEY (assignment_id) REFERENCES hw_assignments(id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  UNIQUE (assignment_id, student_id, attempt_no),
  UNIQUE (student_id, idempotency_key)
);

-- Performance indexes for homework
CREATE INDEX IF NOT EXISTS idx_hw_assignments_class ON hw_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_hw_assignments_teacher ON hw_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_hw_submissions_assignment ON hw_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_hw_submissions_student ON hw_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_hw_submissions_analytics ON hw_submissions(assignment_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_hw_assignments_class_status ON hw_assignments(class_id, status, deadline);
CREATE INDEX IF NOT EXISTS idx_hw_assignments_teacher_status ON hw_assignments(teacher_id, status, deadline);
CREATE INDEX IF NOT EXISTS idx_hw_submissions_assignment_latest ON hw_submissions(assignment_id, student_id, attempt_no DESC);
CREATE INDEX IF NOT EXISTS idx_hw_submissions_student_latest ON hw_submissions(student_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_hw_submissions_published ON hw_submissions(assignment_id, published_at, submitted_at DESC);

-- Test Bank Table
CREATE TABLE IF NOT EXISTS test_bank (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    question_data TEXT NOT NULL,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_test_bank_teacher ON test_bank(teacher_id);

-- Shared system/personal question bank. The legacy test_bank table remains available
-- during rollout and is backfilled into this normalized model below.
CREATE TABLE IF NOT EXISTS question_bank_items (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('SYSTEM', 'PERSONAL')),
  owner_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  question_data TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 3),
  explanation TEXT NOT NULL DEFAULT '',
  grade INTEGER,
  subject TEXT NOT NULL DEFAULT '',
  semester INTEGER,
  topic_code TEXT NOT NULL DEFAULT '',
  lesson_code TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'MANUAL',
  tags TEXT NOT NULL DEFAULT '[]',
  content_hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  archived_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_unique_content
  ON question_bank_items(scope, owner_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_question_bank_browse
  ON question_bank_items(scope, status, grade, subject, semester, topic_code, lesson_code);
CREATE INDEX IF NOT EXISTS idx_question_bank_owner
  ON question_bank_items(owner_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_bank_type_difficulty
  ON question_bank_items(question_type, difficulty);

CREATE TABLE IF NOT EXISTS question_bank_audit (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('CREATE', 'UPDATE', 'PUBLISH', 'ARCHIVE', 'RESTORE', 'BULK_IMPORT')),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_question_bank_audit_item_created
  ON question_bank_audit(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_bank_audit_actor_created
  ON question_bank_audit(actor_id, created_at DESC);

INSERT OR IGNORE INTO question_bank_items (
  id, scope, owner_id, status, question_data, question_text, question_type,
  difficulty, explanation, grade, subject, semester, topic_code, lesson_code,
  source, tags, content_hash, created_by, updated_by, created_at, updated_at,
  published_at
)
SELECT
  id,
  'PERSONAL',
  teacher_id,
  'PUBLISHED',
  question_data,
  CASE WHEN json_valid(question_data)
    THEN COALESCE(json_extract(question_data, '$.question'), json_extract(question_data, '$.mainQuestion'), '')
    ELSE ''
  END,
  CASE WHEN json_valid(question_data)
    THEN COALESCE(json_extract(question_data, '$.type'), '')
    ELSE ''
  END,
  CASE WHEN json_valid(question_data)
    THEN json_extract(question_data, '$.difficulty')
    ELSE NULL
  END,
  CASE WHEN json_valid(question_data)
    THEN COALESCE(json_extract(question_data, '$.explanation'), '')
    ELSE ''
  END,
  NULL,
  CASE WHEN json_valid(question_data)
    THEN COALESCE(json_extract(question_data, '$.subject'), '')
    ELSE ''
  END,
  NULL,
  '',
  '',
  'LEGACY',
  COALESCE(tags, '[]'),
  'legacy:' || id,
  teacher_id,
  teacher_id,
  COALESCE(created_at, datetime('now')),
  COALESCE(created_at, datetime('now')),
  COALESCE(created_at, datetime('now'))
FROM test_bank;

-- Leaderboard Rewards History (Week 2: Leaderboard Rewards)
CREATE TABLE IF NOT EXISTS leaderboard_rewards_history (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  period TEXT NOT NULL, -- 'weekly', 'monthly'
  period_key TEXT NOT NULL, -- '2026-W18', '2026-05'
  rank INTEGER NOT NULL,
  coins_awarded INTEGER DEFAULT 0,
  badge_code TEXT,
  awarded_at TEXT NOT NULL,
  FOREIGN KEY (username) REFERENCES students(username)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_rewards_user ON leaderboard_rewards_history(username, awarded_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rewards_period ON leaderboard_rewards_history(period, period_key);

-- Weekly Quests Progress (Week 3: Weekly Quests)
CREATE TABLE IF NOT EXISTS student_weekly_progress (
  username TEXT NOT NULL,
  week_key TEXT NOT NULL, -- '2026-W18' (ISO week format)
  quest_id TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  target INTEGER NOT NULL,
  claimed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (username, week_key, quest_id),
  FOREIGN KEY (username) REFERENCES students(username)
);

CREATE INDEX IF NOT EXISTS idx_weekly_progress_user_week ON student_weekly_progress(username, week_key);
CREATE INDEX IF NOT EXISTS idx_weekly_progress_quest ON student_weekly_progress(quest_id, week_key);

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

-- Phiếu kết quả nhận xét
CREATE TABLE IF NOT EXISTS phieu_nhanxet (
  id                TEXT PRIMARY KEY,
  submission_id     TEXT NOT NULL UNIQUE,
  student_id        TEXT NOT NULL,
  student_name      TEXT NOT NULL,
  class_id          TEXT NOT NULL,
  mon_hoc           TEXT DEFAULT '',
  ten_bai_tap       TEXT DEFAULT '',
  ngay_lam_bai      TEXT DEFAULT '',
  tong_cau          INTEGER DEFAULT 0,
  so_cau_dung       INTEGER DEFAULT 0,
  so_cau_sai        INTEGER DEFAULT 0,
  diem_so           REAL DEFAULT 0,
  xep_loai          TEXT DEFAULT 'Trung binh',
  nhan_xet_mode     TEXT DEFAULT 'ai',
  nhan_xet_style    TEXT DEFAULT 'nhe_nhang',
  nhan_xet          TEXT DEFAULT '',
  noi_dung_co_gang  TEXT DEFAULT '',
  loi_dong_vien     TEXT DEFAULT '',
  status            TEXT DEFAULT 'draft',
  version           INTEGER DEFAULT 1,
  created_by        TEXT DEFAULT 'teacher',
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phieu_batch (
  id            TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL,
  class_id      TEXT NOT NULL,
  teacher_id    TEXT NOT NULL,
  title         TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  expires_at    TEXT,
  view_count          INTEGER DEFAULT 0,
  is_active           INTEGER DEFAULT 1,
  request_id          TEXT,
  quiz_id             TEXT,
  attempt_policy      TEXT CHECK (attempt_policy IS NULL OR attempt_policy IN ('latest', 'highest', 'first')),
  notify_students     INTEGER NOT NULL DEFAULT 0 CHECK (notify_students IN (0, 1)),
  create_parent_links INTEGER NOT NULL DEFAULT 0 CHECK (create_parent_links IN (0, 1)),
  delivery_status     TEXT NOT NULL DEFAULT 'draft'
    CHECK (delivery_status IN ('draft', 'sending', 'completed', 'partial_failed')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phieu_batch_items (
  batch_id      TEXT NOT NULL,
  phieu_id      TEXT NOT NULL,
  student_name  TEXT,
  PRIMARY KEY (batch_id, phieu_id)
);

CREATE TABLE IF NOT EXISTS phieu_public_links (
  id            TEXT PRIMARY KEY,
  phieu_id      TEXT NOT NULL,
  batch_id      TEXT,
  public_token  TEXT NOT NULL UNIQUE,
  is_active     INTEGER DEFAULT 1,
  expires_at    TEXT,
  view_count    INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS result_report_delivery_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  result_id TEXT NOT NULL,
  phieu_id TEXT,
  student_id TEXT,
  student_name TEXT NOT NULL,
  parent_phone TEXT,
  notification_id TEXT,
  public_link_id TEXT,
  student_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (student_status IN ('not_requested', 'pending', 'sent', 'viewed', 'failed', 'unresolved')),
  parent_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (parent_status IN ('not_requested', 'link_created', 'opened', 'revoked', 'failed')),
  draft_json TEXT NOT NULL DEFAULT '{}',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (batch_id, result_id)
);

CREATE INDEX IF NOT EXISTS idx_phieu_student ON phieu_nhanxet(student_id);
CREATE INDEX IF NOT EXISTS idx_phieu_submission ON phieu_nhanxet(submission_id);
CREATE INDEX IF NOT EXISTS idx_batch_assign ON phieu_batch(assignment_id);
CREATE INDEX IF NOT EXISTS idx_batch_items ON phieu_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_public_links_phieu ON phieu_public_links(phieu_id);
CREATE INDEX IF NOT EXISTS idx_public_links_batch ON phieu_public_links(batch_id);
CREATE INDEX IF NOT EXISTS idx_phieu_public_links_token ON phieu_public_links(public_token);
CREATE INDEX IF NOT EXISTS idx_phieu_nhanxet_submission_id ON phieu_nhanxet(submission_id);
CREATE INDEX IF NOT EXISTS idx_phieu_batch_items_batch_id ON phieu_batch_items(batch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_phieu_batch_teacher_request
  ON phieu_batch (teacher_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_result_report_items_batch
  ON result_report_delivery_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_result_report_items_student
  ON result_report_delivery_items (student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_result_report_items_notification
  ON result_report_delivery_items (notification_id);
CREATE INDEX IF NOT EXISTS idx_result_report_items_public_link
  ON result_report_delivery_items (public_link_id);

-- Certificate system (canonical schema, 2026-07-14)
CREATE TABLE IF NOT EXISTS certificate_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  school_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  bg_image_r2_key TEXT NOT NULL,
  thumbnail_r2_key TEXT,
  fields_config TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
  canvas_width INTEGER NOT NULL DEFAULT 1200 CHECK(canvas_width > 0),
  canvas_height INTEGER NOT NULL DEFAULT 848 CHECK(canvas_height > 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS certificate_batches (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  teacher_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  class_id TEXT,
  quiz_id TEXT,
  template_id TEXT NOT NULL REFERENCES certificate_templates(id),
  title TEXT NOT NULL,
  message TEXT,
  achievement_prefix TEXT,
  date_line TEXT,
  student_name_font TEXT
    CHECK (
      student_name_font IS NULL
      OR student_name_font IN (
        'Great Vibes',
        'Dancing Script',
        'Playwrite VN',
        'Allura',
        'Alex Brush'
      )
    ),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'processing', 'sent', 'partial', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  processing_started_at TEXT,
  error_message TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(teacher_id, request_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  batch_id TEXT NOT NULL REFERENCES certificate_batches(id),
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL DEFAULT '',
  student_score REAL,
  quiz_title TEXT,
  image_url TEXT,
  png_r2_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'revoked')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(batch_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_templates_school ON certificate_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_templates_active ON certificate_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON certificate_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_templates_default ON certificate_templates(is_default, is_active);
CREATE INDEX IF NOT EXISTS idx_batches_teacher ON certificate_batches(teacher_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON certificate_batches(status);
CREATE INDEX IF NOT EXISTS idx_certs_student ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certs_batch ON certificates(batch_id);
CREATE INDEX IF NOT EXISTS idx_certs_status ON certificates(status);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK(user_role IN ('student', 'teacher', 'admin')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0, 1)),
  priority TEXT NOT NULL DEFAULT 'INFO'
    CHECK (priority IN ('INFO', 'REMINDER', 'IMPORTANT', 'URGENT')),
  severity TEXT NOT NULL DEFAULT 'informational'
    CHECK (severity IN ('critical', 'action_required', 'informational')),
  action_url TEXT,
  source_type TEXT,
  source_id TEXT,
  dedupe_key TEXT,
  available_at TEXT,
  expires_at TEXT,
  read_at TEXT,
  clicked_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK(user_role IN ('student', 'teacher', 'admin')),
  action_required_enabled INTEGER NOT NULL DEFAULT 1 CHECK(action_required_enabled IN (0, 1)),
  informational_enabled INTEGER NOT NULL DEFAULT 1 CHECK(informational_enabled IN (0, 1)),
  quiet_hours_enabled INTEGER NOT NULL DEFAULT 0 CHECK(quiet_hours_enabled IN (0, 1)),
  quiet_start TEXT NOT NULL DEFAULT '21:00',
  quiet_end TEXT NOT NULL DEFAULT '06:30',
  timezone_offset_minutes INTEGER NOT NULL DEFAULT 420 CHECK(timezone_offset_minutes BETWEEN -720 AND 840),
  type_preferences_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, user_role)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, user_role, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_inbox
  ON notifications(user_id, user_role, is_read, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_window_dedupe
  ON notifications(user_id, user_role, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_feed
  ON notifications(user_id, user_role, available_at DESC, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_metrics
  ON notifications(sent_at, severity, read_at, clicked_at);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_role
  ON notification_preferences(user_role, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_feed_cursor
  ON notifications(user_id, user_role, is_read, created_at DESC, id DESC);

-- Parent Portal access and one-way communication
CREATE TABLE IF NOT EXISTS parent_links (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  pin_hash TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING', 'ACTIVE', 'REVOKED')),
  token_version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  activated_at TEXT,
  revoked_at TEXT,
  last_accessed_at TEXT,
  FOREIGN KEY(student_id) REFERENCES students(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_links_one_active_student
  ON parent_links(student_id)
  WHERE status IN ('PENDING', 'ACTIVE');
CREATE INDEX IF NOT EXISTS idx_parent_links_creator_created
  ON parent_links(created_by, created_at DESC);

CREATE TABLE IF NOT EXISTS parent_activation_tokens (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(link_id) REFERENCES parent_links(id)
);
CREATE INDEX IF NOT EXISTS idx_parent_activation_link
  ON parent_activation_tokens(link_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS parent_class_announcements (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_important INTEGER NOT NULL DEFAULT 0 CHECK(is_important IN (0,1)),
  status TEXT NOT NULL DEFAULT 'PUBLISHED'
    CHECK(status IN ('PUBLISHED', 'REVOKED')),
  created_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY(class_id) REFERENCES classes(id)
);
CREATE INDEX IF NOT EXISTS idx_parent_announcements_class_published
  ON parent_class_announcements(class_id, published_at DESC);

CREATE TABLE IF NOT EXISTS parent_notifications (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN (
    'quiz_result','result_report','homework_assigned','homework_due',
    'homework_graded','class_announcement','certificate_issued'
  )),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  is_important INTEGER NOT NULL DEFAULT 0 CHECK(is_important IN (0,1)),
  published_at TEXT NOT NULL,
  expires_at TEXT,
  read_at TEXT,
  revoked_at TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL,
  FOREIGN KEY(student_id) REFERENCES students(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_notifications_unique_source
  ON parent_notifications(student_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_student_feed
  ON parent_notifications(student_id, revoked_at, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_student_unread
  ON parent_notifications(student_id, read_at, published_at DESC);

CREATE TABLE IF NOT EXISTS parent_contact_preferences (
  link_id TEXT PRIMARY KEY,
  email TEXT,
  email_normalized TEXT,
  email_verified_at TEXT,
  weekly_digest_enabled INTEGER NOT NULL DEFAULT 0 CHECK (weekly_digest_enabled IN (0, 1)),
  digest_weekday INTEGER NOT NULL DEFAULT 1 CHECK (digest_weekday BETWEEN 1 AND 7),
  digest_hour INTEGER NOT NULL DEFAULT 19 CHECK (digest_hour BETWEEN 0 AND 23),
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh' CHECK (timezone = 'Asia/Ho_Chi_Minh'),
  quiet_hours_enabled INTEGER NOT NULL DEFAULT 1 CHECK (quiet_hours_enabled IN (0, 1)),
  quiet_hours_start_minute INTEGER NOT NULL DEFAULT 1260 CHECK (quiet_hours_start_minute BETWEEN 0 AND 1439),
  quiet_hours_end_minute INTEGER NOT NULL DEFAULT 420 CHECK (quiet_hours_end_minute BETWEEN 0 AND 1439),
  email_kinds_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (link_id) REFERENCES parent_links(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parent_contact_tokens (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('EMAIL_VERIFICATION', 'ACCOUNT_RECOVERY')),
  token_hash TEXT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (link_id) REFERENCES parent_links(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parent_digest_runs (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SENT', 'SKIPPED', 'FAILED')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  provider_message_id TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (link_id, week_start),
  FOREIGN KEY (link_id) REFERENCES parent_links(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parent_account_audit (
  id TEXT PRIMARY KEY,
  link_id TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'PREFERENCES_UPDATED', 'EMAIL_VERIFICATION_REQUESTED', 'EMAIL_VERIFIED',
    'RECOVERY_REQUESTED', 'PIN_RESET', 'DIGEST_SENT', 'DIGEST_FAILED'
  )),
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (link_id) REFERENCES parent_links(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_parent_contact_preferences_digest_due
  ON parent_contact_preferences(weekly_digest_enabled, email_verified_at, digest_weekday, digest_hour);
CREATE INDEX IF NOT EXISTS idx_parent_contact_tokens_lookup
  ON parent_contact_tokens(token_hash, purpose, expires_at, consumed_at);
CREATE INDEX IF NOT EXISTS idx_parent_contact_tokens_link_created
  ON parent_contact_tokens(link_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_digest_runs_status_updated
  ON parent_digest_runs(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_account_audit_link_created
  ON parent_account_audit(link_id, created_at DESC);

-- AI Tutor daily quota and idempotent reservation ledger
CREATE TABLE IF NOT EXISTS ai_tutor_daily_usage (
  username TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student', 'teacher', 'admin')),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username, usage_date)
);

CREATE TABLE IF NOT EXISTS ai_tutor_reservations (
  reservation_key TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  result_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('RESERVED', 'SUCCEEDED', 'FAILED')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_reservations_user_day
  ON ai_tutor_reservations(username, usage_date, status);


-- Results Intervention Center (teacher-only groups, notes and audited assignment batches)
CREATE TABLE IF NOT EXISTS intervention_groups (
  id TEXT PRIMARY KEY,
  teacher_username TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  class_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  subject_label TEXT NOT NULL,
  skill_code TEXT NOT NULL,
  skill_label TEXT NOT NULL,
  sample_size INTEGER NOT NULL CHECK (sample_size >= 0),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_filter_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (teacher_username) REFERENCES teachers(username) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intervention_group_members (
  group_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  latest_result_id TEXT NOT NULL,
  latest_submitted_at TEXT NOT NULL,
  first_attempt_score REAL NOT NULL,
  latest_attempt_score REAL NOT NULL,
  score_delta REAL NOT NULL,
  attempt_count INTEGER NOT NULL,
  skill_accuracy REAL NOT NULL,
  skill_sample_size INTEGER NOT NULL,
  confidence REAL NOT NULL,
  trend_json TEXT NOT NULL DEFAULT '[]',
  added_at TEXT NOT NULL,
  PRIMARY KEY (group_id, student_id),
  FOREIGN KEY (group_id) REFERENCES intervention_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intervention_notes (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  student_id TEXT,
  teacher_username TEXT NOT NULL,
  note_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES intervention_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  FOREIGN KEY (teacher_username) REFERENCES teachers(username) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intervention_assignment_batches (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  teacher_username TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  deadline TEXT NOT NULL,
  max_attempts INTEGER NOT NULL,
  assignment_ids_json TEXT NOT NULL DEFAULT '[]',
  skipped_assignment_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  UNIQUE (teacher_username, idempotency_key),
  FOREIGN KEY (group_id) REFERENCES intervention_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_username) REFERENCES teachers(username) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intervention_audit (
  id TEXT PRIMARY KEY,
  teacher_username TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('GROUP_CREATED', 'GROUP_ARCHIVED', 'NOTE_CREATED', 'ASSIGNMENT_BATCH_CREATED')),
  group_id TEXT,
  student_id TEXT,
  assignment_id TEXT,
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (teacher_username) REFERENCES teachers(username) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES intervention_groups(id) ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_intervention_groups_teacher_updated
  ON intervention_groups(teacher_username, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_intervention_groups_class_skill
  ON intervention_groups(class_id, subject, skill_code, status);
CREATE INDEX IF NOT EXISTS idx_intervention_members_student
  ON intervention_group_members(student_id, group_id);
CREATE INDEX IF NOT EXISTS idx_intervention_notes_group_created
  ON intervention_notes(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intervention_audit_group_created
  ON intervention_audit(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_intervention_group
  ON assignments(intervention_group_id, student_id, status);


-- Stable cursor indexes for bounded large-collection endpoints.
CREATE INDEX IF NOT EXISTS idx_results_cursor
  ON results(submitted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_results_quiz_cursor
  ON results(quiz_id, submitted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_results_class_cursor
  ON results(class_name, submitted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_students_class_name_cursor
  ON students(class_id, archived_at, full_name COLLATE NOCASE, id);
CREATE INDEX IF NOT EXISTS idx_teachers_admin_cursor
  ON teachers(status, full_name COLLATE NOCASE, username);
CREATE INDEX IF NOT EXISTS idx_gift_orders_class_cursor
  ON gift_orders(class_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_gift_orders_student_cursor
  ON gift_orders(student_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_gift_orders_status_cursor
  ON gift_orders(status, updated_at DESC, id DESC);

-- Safe rollout controls for canonical quiz scoring.
-- Compatibility mode still uses the canonical engine; these flags control
-- rollout observability and canonical answer-contract expectations only.
INSERT OR IGNORE INTO feature_flags (
  flag_key, description, enabled, owner, version, created_at, updated_at
) VALUES
  ('quiz_scoring_canonical_v2', 'Canonical quiz scoring and answer contract V2', 1, 'assessment-platform', 1, datetime('now'), datetime('now')),
  ('quiz_scoring_shadow_v2', 'Privacy-safe shadow comparison for quiz scoring V2', 0, 'assessment-platform', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO feature_flag_rules (
  flag_key, audience, percentage, allow_users_json, allow_classes_json,
  starts_at, ends_at, stop_conditions_json, reason, updated_by, updated_at
) VALUES
  ('quiz_scoring_canonical_v2', 'all', 100, '[]', '[]', NULL, NULL,
   '{"max5xxRatePercent":1,"maxClientErrorMultiplier":1.5,"maxP95IncreasePercent":30}',
   'Canonical engine is authoritative; percentage may be reduced without restoring the faulty legacy grader',
   'migration-0059', datetime('now')),
  ('quiz_scoring_shadow_v2', 'all', 100, '[]', '[]', NULL, NULL,
   '{"max5xxRatePercent":1,"maxClientErrorMultiplier":2,"maxP95IncreasePercent":40}',
   'Enable only while comparing client metadata with authoritative canonical results',
   'migration-0059', datetime('now'));

-- Shared question-bank rollout is disabled until backend and frontend verification pass.
INSERT OR IGNORE INTO feature_flags (
  flag_key, description, enabled, owner, version, created_at, updated_at
) VALUES (
  'system_question_bank_v1', 'System-wide shared question bank', 0,
  'assessment-platform', 1, datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO feature_flag_rules (
  flag_key, audience, percentage, allow_users_json, allow_classes_json,
  starts_at, ends_at, stop_conditions_json, reason, updated_by, updated_at
) VALUES (
  'system_question_bank_v1', 'teacher', 100, '[]', '[]', NULL, NULL,
  '{"max5xxRatePercent":1,"maxClientErrorMultiplier":2,"maxP95IncreasePercent":30}',
  'Disabled until shared question-bank API and UI verification completes',
  'migration-0060', datetime('now')
);

-- Canonical migration 0069_competition_core.sql
-- Competition V1 core domain: campaign, frozen audience, six rounds, attempts,
-- materialized progress, and immutable/versioned eligibility snapshots.

CREATE TABLE IF NOT EXISTS competition_campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  school_year TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'SCHEDULED', 'ACTIVE', 'ELIGIBILITY_LOCKED', 'EXAM_PREP',
      'EXAM_RUNNING', 'WITHHELD', 'RECONCILING', 'READY_TO_PUBLISH',
      'PUBLISHED', 'ARCHIVED'
    )),
  audience_rule_json TEXT NOT NULL DEFAULT '{}',
  audience_snapshot_id TEXT,
  eligibility_policy_json TEXT NOT NULL DEFAULT '{"requiredRounds":6,"requiredPassedRounds":6}',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS competition_audience_snapshots (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'BUILDING'
    CHECK (status IN ('BUILDING', 'LOCKED')),
  member_count INTEGER NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  snapshot_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  locked_at TEXT,
  created_by TEXT NOT NULL,
  UNIQUE (campaign_id, version),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  CHECK (status <> 'LOCKED' OR (locked_at IS NOT NULL AND length(snapshot_hash) > 0))
);

CREATE TABLE IF NOT EXISTS competition_audience_members (
  audience_snapshot_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  grade_level_at_snapshot INTEGER NOT NULL CHECK (grade_level_at_snapshot BETWEEN 1 AND 12),
  class_id_at_snapshot TEXT NOT NULL,
  student_status_at_snapshot TEXT NOT NULL,
  PRIMARY KEY (audience_snapshot_id, student_id),
  FOREIGN KEY (audience_snapshot_id) REFERENCES competition_audience_snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS competition_quiz_snapshots (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  canonical_payload_json TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE (quiz_id, sha256),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE RESTRICT,
  CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*')
);

CREATE TABLE IF NOT EXISTS competition_rounds (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 6),
  opens_at TEXT NOT NULL,
  closes_at TEXT NOT NULL,
  max_attempts INTEGER NOT NULL CHECK (max_attempts > 0),
  passing_rule_type TEXT NOT NULL DEFAULT 'MIN_SCORE'
    CHECK (passing_rule_type IN ('MIN_SCORE')),
  passing_score REAL NOT NULL CHECK (passing_score BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'FINALIZED')),
  created_at TEXT NOT NULL,
  finalized_at TEXT,
  UNIQUE (campaign_id, round_number),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  CHECK (closes_at > opens_at),
  CHECK (status <> 'FINALIZED' OR finalized_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS competition_round_quizzes (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
  class_id TEXT,
  quiz_id TEXT NOT NULL,
  quiz_snapshot_id TEXT NOT NULL,
  quiz_snapshot_hash TEXT NOT NULL,
  locked_at TEXT NOT NULL,
  FOREIGN KEY (round_id) REFERENCES competition_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE RESTRICT,
  FOREIGN KEY (quiz_snapshot_id) REFERENCES competition_quiz_snapshots(id) ON DELETE RESTRICT,
  CHECK (length(quiz_snapshot_hash) = 64 AND quiz_snapshot_hash NOT GLOB '*[^0-9a-f]*')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_competition_round_quizzes_grade_default
  ON competition_round_quizzes(round_id, grade_level)
  WHERE class_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_competition_round_quizzes_class_override
  ON competition_round_quizzes(round_id, grade_level, class_id)
  WHERE class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS competition_round_attempts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
  quiz_id TEXT NOT NULL,
  quiz_snapshot_id TEXT NOT NULL,
  quiz_snapshot_hash TEXT NOT NULL,
  result_id INTEGER,
  status TEXT NOT NULL DEFAULT 'STARTED'
    CHECK (status IN ('STARTED', 'SUBMITTED', 'SCORED', 'EXPIRED', 'VOID')),
  score REAL CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  correct_count INTEGER CHECK (correct_count IS NULL OR correct_count >= 0),
  time_taken INTEGER CHECK (time_taken IS NULL OR time_taken >= 0),
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  scored_at TEXT,
  voided_at TEXT,
  voided_by TEXT,
  void_reason TEXT,
  idempotency_key TEXT NOT NULL,
  UNIQUE (round_id, student_id, attempt_no),
  UNIQUE (student_id, idempotency_key),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES competition_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE RESTRICT,
  FOREIGN KEY (quiz_snapshot_id) REFERENCES competition_quiz_snapshots(id) ON DELETE RESTRICT,
  FOREIGN KEY (result_id) REFERENCES results(id) ON DELETE SET NULL,
  CHECK (length(quiz_snapshot_hash) = 64 AND quiz_snapshot_hash NOT GLOB '*[^0-9a-f]*'),
  CHECK (status <> 'SCORED' OR (score IS NOT NULL AND scored_at IS NOT NULL)),
  CHECK (status <> 'VOID' OR (voided_at IS NOT NULL AND length(trim(COALESCE(void_reason, ''))) > 0))
);

CREATE TABLE IF NOT EXISTS competition_round_progress (
  campaign_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  attempts_used INTEGER NOT NULL DEFAULT 0 CHECK (attempts_used >= 0),
  best_attempt_id TEXT,
  best_score REAL CHECK (best_score IS NULL OR best_score BETWEEN 0 AND 100),
  is_passed INTEGER NOT NULL DEFAULT 0 CHECK (is_passed IN (0, 1)),
  passed_at TEXT,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (campaign_id, round_id, student_id),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (round_id) REFERENCES competition_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (best_attempt_id) REFERENCES competition_round_attempts(id) ON DELETE SET NULL,
  CHECK (is_passed = 0 OR best_attempt_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS competition_eligibility (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  eligibility_snapshot_version INTEGER NOT NULL CHECK (eligibility_snapshot_version > 0),
  student_id TEXT NOT NULL,
  qualified INTEGER NOT NULL CHECK (qualified IN (0, 1)),
  reason_codes_json TEXT NOT NULL DEFAULT '[]',
  qualified_at TEXT,
  computed_at TEXT NOT NULL,
  progress_digest TEXT NOT NULL,
  override_reason TEXT,
  overridden_by TEXT,
  overridden_at TEXT,
  UNIQUE (campaign_id, eligibility_snapshot_version, student_id),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  CHECK (qualified = 0 OR qualified_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_competition_campaigns_status_window
  ON competition_campaigns(status, starts_at, ends_at, id);

CREATE INDEX IF NOT EXISTS idx_competition_audience_snapshots_campaign_status
  ON competition_audience_snapshots(campaign_id, status, version DESC);

CREATE INDEX IF NOT EXISTS idx_competition_audience_members_student
  ON competition_audience_members(student_id, audience_snapshot_id);

-- Frozen audience snapshots are authoritative historical inputs. Once locked,
-- neither snapshot metadata nor membership rows may be mutated in place.
CREATE TRIGGER IF NOT EXISTS trg_competition_audience_snapshot_locked_update
BEFORE UPDATE ON competition_audience_snapshots
WHEN OLD.status = 'LOCKED'
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AUDIENCE_SNAPSHOT_LOCKED');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_audience_snapshot_locked_delete
BEFORE DELETE ON competition_audience_snapshots
WHEN OLD.status = 'LOCKED'
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AUDIENCE_SNAPSHOT_LOCKED');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_audience_member_locked_insert
BEFORE INSERT ON competition_audience_members
WHEN EXISTS (
  SELECT 1 FROM competition_audience_snapshots
  WHERE id = NEW.audience_snapshot_id AND status = 'LOCKED'
)
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AUDIENCE_SNAPSHOT_LOCKED');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_audience_member_locked_update
BEFORE UPDATE ON competition_audience_members
WHEN EXISTS (
  SELECT 1 FROM competition_audience_snapshots
  WHERE id = OLD.audience_snapshot_id AND status = 'LOCKED'
)
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AUDIENCE_SNAPSHOT_LOCKED');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_audience_member_locked_delete
BEFORE DELETE ON competition_audience_members
WHEN EXISTS (
  SELECT 1 FROM competition_audience_snapshots
  WHERE id = OLD.audience_snapshot_id AND status = 'LOCKED'
)
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AUDIENCE_SNAPSHOT_LOCKED');
END;

CREATE INDEX IF NOT EXISTS idx_competition_quiz_snapshots_quiz_created
  ON competition_quiz_snapshots(quiz_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_competition_rounds_campaign_window
  ON competition_rounds(campaign_id, status, opens_at, closes_at, round_number);

CREATE INDEX IF NOT EXISTS idx_competition_round_attempts_student_round
  ON competition_round_attempts(student_id, round_id, attempt_no DESC);

CREATE INDEX IF NOT EXISTS idx_competition_round_attempts_campaign_status
  ON competition_round_attempts(campaign_id, status, round_id, student_id);

CREATE INDEX IF NOT EXISTS idx_competition_round_attempts_result
  ON competition_round_attempts(result_id)
  WHERE result_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competition_round_progress_dashboard
  ON competition_round_progress(campaign_id, round_id, status, is_passed, student_id);

CREATE INDEX IF NOT EXISTS idx_competition_round_progress_student
  ON competition_round_progress(student_id, campaign_id, round_id);

CREATE INDEX IF NOT EXISTS idx_competition_eligibility_campaign_version
  ON competition_eligibility(campaign_id, eligibility_snapshot_version, qualified, student_id);

CREATE INDEX IF NOT EXISTS idx_competition_eligibility_student
  ON competition_eligibility(student_id, campaign_id, eligibility_snapshot_version DESC);

-- Eligibility versions are append-only historical snapshots. Administrative
-- exceptions create a new version rather than mutating rows already referenced
-- by downstream school-exam workflows.
CREATE TRIGGER IF NOT EXISTS trg_competition_eligibility_immutable_update
BEFORE UPDATE ON competition_eligibility
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_ELIGIBILITY_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_eligibility_immutable_delete
BEFORE DELETE ON competition_eligibility
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_ELIGIBILITY_IMMUTABLE');
END;

-- Canonical migration 0070_competition_school_exam.sql
-- Competition V1 school-exam persistence and additive Live Exam participant scope.
-- Existing class Live Exam sessions remain CLASS + PUBLISHED; competition rooms
-- must be SCHOOL_EXAM_ROOM + WITHHELD until publication is explicitly reconciled.

ALTER TABLE live_exam_sessions ADD COLUMN participant_scope_type TEXT NOT NULL DEFAULT 'CLASS'
  CHECK (participant_scope_type IN ('CLASS', 'SCHOOL_EXAM_ROOM'));
ALTER TABLE live_exam_sessions ADD COLUMN participant_scope_id TEXT;
ALTER TABLE live_exam_sessions ADD COLUMN result_visibility TEXT NOT NULL DEFAULT 'PUBLISHED'
  CHECK (result_visibility IN ('WITHHELD', 'PUBLISHED'));

UPDATE live_exam_sessions
SET participant_scope_id = class_id
WHERE participant_scope_type = 'CLASS'
  AND participant_scope_id IS NULL
  AND class_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS competition_school_exam_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  eligibility_snapshot_version INTEGER NOT NULL CHECK (eligibility_snapshot_version > 0),
  title TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'PREFLIGHT_BLOCKED', 'READY', 'SCHEDULED', 'IN_PROGRESS',
      'WITHHELD', 'RECONCILING', 'READY_TO_PUBLISH', 'PUBLISHED'
    )),
  ranking_policy TEXT NOT NULL DEFAULT 'SCORE_CORRECT_TIME'
    CHECK (ranking_policy IN ('SCORE_CORRECT_TIME')),
  exam_form_policy TEXT NOT NULL DEFAULT 'SAME_FORM'
    CHECK (exam_form_policy IN ('SAME_FORM', 'EQUIVALENT_FORM_SET')),
  capacity_profile_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE RESTRICT,
  UNIQUE (campaign_id, id)
);

CREATE TABLE IF NOT EXISTS competition_school_exam_rooms (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  room_code TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 300),
  check_in_lead_minutes INTEGER NOT NULL DEFAULT 0 CHECK (check_in_lead_minutes BETWEEN 0 AND 120),
  close_drain_minutes INTEGER NOT NULL DEFAULT 0 CHECK (close_drain_minutes BETWEEN 0 AND 120),
  form_code TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  quiz_snapshot_id TEXT,
  live_exam_session_id TEXT,
  invigilator_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'READY', 'SCHEDULED', 'IN_PROGRESS', 'WITHHELD', 'RECONCILING', 'READY_TO_PUBLISH', 'PUBLISHED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, room_code),
  UNIQUE (live_exam_session_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE RESTRICT,
  FOREIGN KEY (quiz_snapshot_id) REFERENCES competition_quiz_snapshots(id) ON DELETE RESTRICT,
  FOREIGN KEY (live_exam_session_id) REFERENCES live_exam_sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS competition_school_exam_members (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  original_class_id TEXT NOT NULL,
  eligibility_snapshot_version INTEGER NOT NULL CHECK (eligibility_snapshot_version > 0),
  status TEXT NOT NULL DEFAULT 'ASSIGNED'
    CHECK (status IN ('ASSIGNED', 'CHECKED_IN', 'STARTED', 'SUBMITTED', 'ABSENT', 'VOID', 'RETEST_APPROVED')),
  assigned_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (event_id, student_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (original_class_id) REFERENCES classes(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS competition_school_exam_results (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  original_class_id TEXT NOT NULL,
  live_exam_session_id TEXT NOT NULL,
  live_exam_participant_id TEXT,
  score REAL CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  correct_count INTEGER CHECK (correct_count IS NULL OR correct_count >= 0),
  time_taken INTEGER CHECK (time_taken IS NULL OR time_taken >= 0),
  rank INTEGER CHECK (rank IS NULL OR rank > 0),
  status TEXT NOT NULL DEFAULT 'WITHHELD'
    CHECK (status IN ('WITHHELD', 'RECONCILED', 'VOID', 'PUBLISHED')),
  source_result_id INTEGER,
  computed_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (event_id, student_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (original_class_id) REFERENCES classes(id) ON DELETE RESTRICT,
  FOREIGN KEY (live_exam_session_id) REFERENCES live_exam_sessions(id) ON DELETE RESTRICT,
  FOREIGN KEY (live_exam_participant_id) REFERENCES live_exam_participants(id) ON DELETE SET NULL,
  FOREIGN KEY (source_result_id) REFERENCES results(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS competition_school_exam_incidents (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  room_id TEXT,
  student_id TEXT,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  details_json TEXT NOT NULL DEFAULT '{}',
  reported_by TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution_json TEXT,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS competition_school_exam_retests (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  source_result_id TEXT,
  replacement_room_id TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'APPROVED', 'DENIED', 'PROVISIONED', 'COMPLETED', 'VOID')),
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (source_result_id) REFERENCES competition_school_exam_results(id) ON DELETE SET NULL,
  FOREIGN KEY (replacement_room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS competition_school_exam_reconcile_runs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED', 'RUNNING', 'BLOCKED', 'SUCCEEDED', 'FAILED')),
  request_id TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  started_by TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (event_id, request_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competition_school_exam_publications (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'PREPARED' CHECK (status IN ('PREPARED', 'PUBLISHED', 'SUPERSEDED')),
  result_digest TEXT NOT NULL,
  published_by TEXT,
  prepared_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (event_id, version),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competition_school_exam_exports (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  publication_version INTEGER,
  scope TEXT NOT NULL CHECK (scope IN ('SCHOOL', 'CLASS')),
  class_id TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'READY', 'FAILED')),
  request_id TEXT NOT NULL,
  artifact_key TEXT,
  error_code TEXT,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (event_id, request_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  CHECK (scope <> 'CLASS' OR class_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS competition_school_exam_certificate_batches (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  publication_version INTEGER NOT NULL CHECK (publication_version > 0),
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'READY', 'FAILED')),
  request_id TEXT NOT NULL,
  artifact_key TEXT,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (event_id, request_id),
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competition_school_exam_audit (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  room_id TEXT,
  student_id TEXT,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  request_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_school_exam_events_campaign_status
  ON competition_school_exam_events(campaign_id, status, exam_date, id);
CREATE INDEX IF NOT EXISTS idx_school_exam_rooms_event_status
  ON competition_school_exam_rooms(event_id, status, scheduled_at, id);
CREATE INDEX IF NOT EXISTS idx_school_exam_members_room_status
  ON competition_school_exam_members(room_id, status, student_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_results_event_status
  ON competition_school_exam_results(event_id, status, rank, student_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_incidents_event_room
  ON competition_school_exam_incidents(event_id, room_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_exam_retests_event_status
  ON competition_school_exam_retests(event_id, status, student_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_reconcile_event_status
  ON competition_school_exam_reconcile_runs(event_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_exam_publications_event_version
  ON competition_school_exam_publications(event_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_school_exam_exports_event_status
  ON competition_school_exam_exports(event_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_exam_certificate_batches_event_status
  ON competition_school_exam_certificate_batches(event_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_exam_audit_event_created
  ON competition_school_exam_audit(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_participant_scope
  ON live_exam_sessions(participant_scope_type, participant_scope_id, status);

-- School-exam events must pin an eligibility snapshot version that already exists.
CREATE TRIGGER IF NOT EXISTS trg_school_exam_event_eligibility_insert
BEFORE INSERT ON competition_school_exam_events
WHEN NOT EXISTS (
  SELECT 1
  FROM competition_eligibility
  WHERE campaign_id = NEW.campaign_id
    AND eligibility_snapshot_version = NEW.eligibility_snapshot_version
)
BEGIN
  SELECT RAISE(ABORT, 'ELIGIBILITY_SNAPSHOT_VERSION_NOT_FOUND');
END;

CREATE TRIGGER IF NOT EXISTS trg_school_exam_event_eligibility_reference_immutable
BEFORE UPDATE OF campaign_id, eligibility_snapshot_version ON competition_school_exam_events
WHEN NEW.campaign_id <> OLD.campaign_id
  OR NEW.eligibility_snapshot_version <> OLD.eligibility_snapshot_version
BEGIN
  SELECT RAISE(ABORT, 'ELIGIBILITY_REFERENCE_IMMUTABLE');
END;

-- Preserve the existing class Live Exam path without forcing callers to know about
-- competition scoping. New class rows inherit CLASS + PUBLISHED and scope to class_id.
CREATE TRIGGER IF NOT EXISTS trg_live_exam_class_scope_insert
AFTER INSERT ON live_exam_sessions
WHEN NEW.participant_scope_type = 'CLASS'
  AND NEW.participant_scope_id IS NULL
  AND NEW.class_id IS NOT NULL
BEGIN
  UPDATE live_exam_sessions
  SET participant_scope_id = NEW.class_id
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_live_exam_class_visibility_insert
BEFORE INSERT ON live_exam_sessions
WHEN NEW.participant_scope_type = 'CLASS' AND NEW.result_visibility <> 'PUBLISHED'
BEGIN
  SELECT RAISE(ABORT, 'CLASS_RESULTS_MUST_BE_PUBLISHED');
END;

CREATE TRIGGER IF NOT EXISTS trg_live_exam_school_class_forbidden_insert
BEFORE INSERT ON live_exam_sessions
WHEN NEW.participant_scope_type = 'SCHOOL_EXAM_ROOM'
  AND NEW.class_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_CLASS_SCOPE_FORBIDDEN');
END;

CREATE TRIGGER IF NOT EXISTS trg_live_exam_school_scope_insert
BEFORE INSERT ON live_exam_sessions
WHEN NEW.participant_scope_type = 'SCHOOL_EXAM_ROOM'
  AND (
    NEW.result_visibility <> 'WITHHELD'
    OR NEW.participant_scope_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM competition_school_exam_rooms
      WHERE id = NEW.participant_scope_id
    )
  )
BEGIN
  SELECT RAISE(ABORT,
    CASE
      WHEN NEW.result_visibility <> 'WITHHELD' THEN 'SCHOOL_EXAM_RESULTS_MUST_BE_WITHHELD'
      ELSE 'SCHOOL_EXAM_ROOM_SCOPE_INVALID'
    END
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_live_exam_scope_update
BEFORE UPDATE OF class_id, participant_scope_type, participant_scope_id, result_visibility ON live_exam_sessions
WHEN (
  NEW.participant_scope_type = 'CLASS' AND NEW.result_visibility <> 'PUBLISHED'
) OR (
  NEW.participant_scope_type = 'SCHOOL_EXAM_ROOM'
  AND (
    NEW.class_id IS NOT NULL
    OR NEW.result_visibility <> 'WITHHELD'
    OR NEW.participant_scope_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM competition_school_exam_rooms
      WHERE id = NEW.participant_scope_id
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'LIVE_EXAM_SCOPE_VISIBILITY_INVALID');
END;

-- Canonical migration 0071_live_exam_capacity_profiles.sql
-- Competition V1 certified Live Exam capacity profiles.
-- Only benchmark runs that satisfy every certification gate may be persisted.
CREATE TABLE IF NOT EXISTS live_exam_capacity_profiles (
  id TEXT PRIMARY KEY,
  benchmark_run_id TEXT NOT NULL UNIQUE,
  build_sha TEXT NOT NULL,
  runtime_config_version TEXT NOT NULL,
  polling_profile_version TEXT NOT NULL,
  certified_concurrent_students INTEGER NOT NULL CHECK (certified_concurrent_students > 0),
  status_p95_ms REAL NOT NULL CHECK (status_p95_ms >= 0 AND status_p95_ms < 500),
  submit_p95_ms REAL NOT NULL CHECK (submit_p95_ms >= 0 AND submit_p95_ms < 2000),
  lost_answers INTEGER NOT NULL CHECK (lost_answers = 0),
  duplicate_failures INTEGER NOT NULL CHECK (duplicate_failures = 0),
  d1_overload INTEGER NOT NULL CHECK (d1_overload = 0),
  app_5xx INTEGER NOT NULL CHECK (app_5xx = 0),
  network_errors INTEGER NOT NULL CHECK (network_errors = 0),
  status TEXT NOT NULL DEFAULT 'CERTIFIED' CHECK (status = 'CERTIFIED'),
  passed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_exam_capacity_profiles_passed
  ON live_exam_capacity_profiles(passed_at DESC, certified_concurrent_students DESC);

-- Canonical migration 0072_competition_school_exam_orchestration.sql
-- Competition V1 Task 12: school-exam orchestration state needed for
-- idempotent room planning, form-equivalence validation, capacity preflight,
-- and retryable Live Exam provisioning.

ALTER TABLE competition_school_exam_events ADD COLUMN create_request_id TEXT;
ALTER TABLE competition_school_exam_events ADD COLUMN preflight_json TEXT;
ALTER TABLE competition_school_exam_events ADD COLUMN preflight_at TEXT;

ALTER TABLE competition_school_exam_rooms ADD COLUMN member_count INTEGER NOT NULL DEFAULT 0
  CHECK (member_count >= 0);
ALTER TABLE competition_school_exam_rooms ADD COLUMN form_definition_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE competition_school_exam_rooms ADD COLUMN equivalent_form_approved_by TEXT;
ALTER TABLE competition_school_exam_rooms ADD COLUMN equivalent_form_approved_at TEXT;
ALTER TABLE competition_school_exam_rooms ADD COLUMN provision_status TEXT NOT NULL DEFAULT 'PENDING'
  CHECK (provision_status IN ('PENDING', 'READY', 'FAILED'));
ALTER TABLE competition_school_exam_rooms ADD COLUMN provision_error_code TEXT;
ALTER TABLE competition_school_exam_rooms ADD COLUMN create_request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_events_create_request
  ON competition_school_exam_events(campaign_id, create_request_id)
  WHERE create_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_rooms_create_request
  ON competition_school_exam_rooms(event_id, create_request_id)
  WHERE create_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_school_exam_rooms_provision
  ON competition_school_exam_rooms(event_id, provision_status, live_exam_session_id);

-- Canonical migration 0073_competition_school_exam_reconcile.sql
-- Competition V1 canonical result reconciliation.
-- Adds monotonic run versions plus durable, per-run issue rows while preserving
-- raw Live Exam sessions/participants as immutable reconciliation inputs.

ALTER TABLE competition_school_exam_reconcile_runs ADD COLUMN version INTEGER;

UPDATE competition_school_exam_reconcile_runs
SET version = (
  SELECT COUNT(*)
  FROM competition_school_exam_reconcile_runs AS prior
  WHERE prior.event_id = competition_school_exam_reconcile_runs.event_id
    AND (
      prior.started_at < competition_school_exam_reconcile_runs.started_at
      OR (
        prior.started_at = competition_school_exam_reconcile_runs.started_at
        AND prior.id <= competition_school_exam_reconcile_runs.id
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_reconcile_event_version
  ON competition_school_exam_reconcile_runs(event_id, version);

CREATE TRIGGER IF NOT EXISTS trg_school_exam_reconcile_version_required
BEFORE INSERT ON competition_school_exam_reconcile_runs
WHEN NEW.version IS NULL OR NEW.version <= 0
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_RECONCILE_VERSION_REQUIRED');
END;

CREATE TABLE IF NOT EXISTS competition_school_exam_reconcile_issues (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  room_id TEXT,
  student_id TEXT,
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'MISSING_PARTICIPANT',
    'MISSING_SUBMISSION',
    'DUPLICATE_RESULT',
    'ROOM_MEMBER_MISMATCH',
    'SCORE_MISSING',
    'RETEST_PENDING',
    'EXAM_NOT_CLOSED'
  )),
  blocking INTEGER NOT NULL DEFAULT 1 CHECK (blocking IN (0, 1)),
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES competition_school_exam_reconcile_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_school_exam_reconcile_issues_run
  ON competition_school_exam_reconcile_issues(run_id, blocking, issue_type, id);
CREATE INDEX IF NOT EXISTS idx_school_exam_reconcile_issues_event
  ON competition_school_exam_reconcile_issues(event_id, issue_type, room_id, student_id);

-- Canonical migration 0074_competition_school_exam_incident_retest.sql
-- Competition V1 Task 14: scoped incidents, Admin-granted retests, and
-- durable reconciliation lineage. Raw Live Exam rows remain immutable inputs.

ALTER TABLE competition_school_exam_incidents ADD COLUMN request_id TEXT;

ALTER TABLE competition_school_exam_retests ADD COLUMN incident_id TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN reason_code TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN reason_text TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN grant_request_id TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN expires_at TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN live_exam_session_id TEXT;
ALTER TABLE competition_school_exam_retests ADD COLUMN resolution TEXT
  CHECK (resolution IS NULL OR resolution IN ('KEEP_ORIGINAL', 'REPLACE_WITH_RETEST', 'INVALIDATE_RESULT'));

ALTER TABLE competition_school_exam_results ADD COLUMN retest_id TEXT;
ALTER TABLE competition_school_exam_results ADD COLUMN resolution TEXT
  CHECK (resolution IS NULL OR resolution IN ('KEEP_ORIGINAL', 'REPLACE_WITH_RETEST', 'INVALIDATE_RESULT'));
ALTER TABLE competition_school_exam_results ADD COLUMN reconcile_version INTEGER
  CHECK (reconcile_version IS NULL OR reconcile_version > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_incidents_event_request
  ON competition_school_exam_incidents(event_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_retests_incident
  ON competition_school_exam_retests(incident_id)
  WHERE incident_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_retests_grant_request
  ON competition_school_exam_retests(event_id, grant_request_id)
  WHERE grant_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_retests_live_session
  ON competition_school_exam_retests(live_exam_session_id)
  WHERE live_exam_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS competition_school_exam_result_history (
  id TEXT PRIMARY KEY,
  canonical_result_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  original_class_id TEXT NOT NULL,
  live_exam_session_id TEXT NOT NULL,
  live_exam_participant_id TEXT,
  score REAL,
  correct_count INTEGER,
  time_taken INTEGER,
  rank INTEGER,
  result_status TEXT NOT NULL,
  disposition TEXT NOT NULL CHECK (disposition IN ('SUPERSEDED')),
  retest_id TEXT NOT NULL,
  reconcile_version INTEGER NOT NULL CHECK (reconcile_version > 0),
  superseded_at TEXT NOT NULL,
  UNIQUE (canonical_result_id, retest_id),
  FOREIGN KEY (canonical_result_id) REFERENCES competition_school_exam_results(id) ON DELETE RESTRICT,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (room_id) REFERENCES competition_school_exam_rooms(id) ON DELETE RESTRICT,
  FOREIGN KEY (retest_id) REFERENCES competition_school_exam_retests(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_school_exam_result_history_event_student
  ON competition_school_exam_result_history(event_id, student_id, reconcile_version DESC);

CREATE TRIGGER IF NOT EXISTS trg_school_exam_result_delete_forbidden
BEFORE DELETE ON competition_school_exam_results
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_RESULT_DELETE_FORBIDDEN');
END;

-- Canonical migration 0075_competition_school_exam_publication_ranking.sql
-- Competition V1 Task 15: immutable publication versions and ranking snapshots.
-- Rankings are materialized from canonical results at publish time so later
-- corrections can create a new version without rewriting prior official data.

ALTER TABLE competition_school_exam_publications ADD COLUMN ranking_version INTEGER
  CHECK (ranking_version IS NULL OR ranking_version > 0);
ALTER TABLE competition_school_exam_publications ADD COLUMN request_id TEXT;
ALTER TABLE competition_school_exam_publications ADD COLUMN reconcile_version INTEGER
  CHECK (reconcile_version IS NULL OR reconcile_version > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_publications_event_request
  ON competition_school_exam_publications(event_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_school_exam_publications_event_ranking_version
  ON competition_school_exam_publications(event_id, ranking_version)
  WHERE ranking_version IS NOT NULL;

-- Task 12 correctly forced competition sessions to stay WITHHELD before publication.
-- Replace that update trigger with a publication-aware guard: creation is still
-- WITHHELD-only, while a later PUBLISHED transition requires a durable official
-- publication for the room's event.
DROP TRIGGER IF EXISTS trg_live_exam_scope_update;
CREATE TRIGGER trg_live_exam_scope_update
BEFORE UPDATE OF class_id, participant_scope_type, participant_scope_id, result_visibility ON live_exam_sessions
WHEN (
  NEW.participant_scope_type = 'CLASS' AND NEW.result_visibility <> 'PUBLISHED'
) OR (
  NEW.participant_scope_type = 'SCHOOL_EXAM_ROOM'
  AND (
    NEW.class_id IS NOT NULL
    OR NEW.result_visibility NOT IN ('WITHHELD', 'PUBLISHED')
    OR NEW.participant_scope_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM competition_school_exam_rooms
      WHERE id = NEW.participant_scope_id
    )
    OR (
      NEW.result_visibility = 'PUBLISHED'
      AND NOT EXISTS (
        SELECT 1
        FROM competition_school_exam_rooms AS rooms
        JOIN competition_school_exam_publications AS publications
          ON publications.event_id = rooms.event_id
         AND publications.status = 'PUBLISHED'
        WHERE rooms.id = NEW.participant_scope_id
      )
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'LIVE_EXAM_SCOPE_VISIBILITY_INVALID');
END;

CREATE TABLE IF NOT EXISTS competition_school_exam_publication_results (
  id TEXT PRIMARY KEY,
  publication_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  publication_version INTEGER NOT NULL CHECK (publication_version > 0),
  ranking_version INTEGER NOT NULL CHECK (ranking_version > 0),
  canonical_result_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  original_class_id TEXT NOT NULL,
  grade_level INTEGER NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
  score REAL NOT NULL,
  correct_count INTEGER,
  time_taken INTEGER,
  rank_event INTEGER NOT NULL CHECK (rank_event > 0),
  rank_grade INTEGER NOT NULL CHECK (rank_grade > 0),
  rank_class INTEGER NOT NULL CHECK (rank_class > 0),
  source_reconcile_version INTEGER NOT NULL CHECK (source_reconcile_version > 0),
  published_at TEXT NOT NULL,
  UNIQUE (publication_id, student_id),
  UNIQUE (event_id, publication_version, student_id),
  FOREIGN KEY (publication_id) REFERENCES competition_school_exam_publications(id) ON DELETE RESTRICT,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE RESTRICT,
  FOREIGN KEY (canonical_result_id) REFERENCES competition_school_exam_results(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (original_class_id) REFERENCES classes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_school_exam_publication_results_event
  ON competition_school_exam_publication_results(event_id, publication_version DESC, rank_event, student_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_publication_results_grade
  ON competition_school_exam_publication_results(event_id, publication_version DESC, grade_level, rank_grade, student_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_publication_results_class
  ON competition_school_exam_publication_results(event_id, publication_version DESC, original_class_id, rank_class, student_id);

CREATE TRIGGER IF NOT EXISTS trg_school_exam_publication_immutable_update
BEFORE UPDATE ON competition_school_exam_publications
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_PUBLICATION_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_school_exam_publication_immutable_delete
BEFORE DELETE ON competition_school_exam_publications
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_PUBLICATION_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_school_exam_publication_result_immutable_update
BEFORE UPDATE ON competition_school_exam_publication_results
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_PUBLICATION_RESULT_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_school_exam_publication_result_immutable_delete
BEFORE DELETE ON competition_school_exam_publication_results
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_PUBLICATION_RESULT_IMMUTABLE');
END;

-- Canonical migration 0076_competition_certificate_adapter.sql
-- Competition V1 Task 16: adapt published ranking winners into the existing
-- class-oriented certificate batch engine without creating fake classes.

ALTER TABLE competition_school_exam_certificate_batches ADD COLUMN ranking_version INTEGER
  CHECK (ranking_version IS NULL OR ranking_version > 0);
ALTER TABLE competition_school_exam_certificate_batches ADD COLUMN template_id TEXT;
ALTER TABLE competition_school_exam_certificate_batches ADD COLUMN winner_count INTEGER NOT NULL DEFAULT 0
  CHECK (winner_count >= 0);
ALTER TABLE competition_school_exam_certificate_batches ADD COLUMN error_code TEXT;

CREATE TABLE IF NOT EXISTS competition_school_exam_certificate_batch_items (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  publication_version INTEGER NOT NULL CHECK (publication_version > 0),
  ranking_version INTEGER NOT NULL CHECK (ranking_version > 0),
  original_class_id TEXT NOT NULL,
  certificate_batch_id TEXT NOT NULL,
  winner_count INTEGER NOT NULL CHECK (winner_count > 0),
  created_at TEXT NOT NULL,
  UNIQUE (parent_id, original_class_id),
  UNIQUE (parent_id, certificate_batch_id),
  FOREIGN KEY (parent_id) REFERENCES competition_school_exam_certificate_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE CASCADE,
  FOREIGN KEY (original_class_id) REFERENCES classes(id) ON DELETE RESTRICT,
  FOREIGN KEY (certificate_batch_id) REFERENCES certificate_batches(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_school_exam_certificate_batch_items_event_version
  ON competition_school_exam_certificate_batch_items(event_id, publication_version, ranking_version, original_class_id);
CREATE INDEX IF NOT EXISTS idx_school_exam_certificate_batch_items_batch
  ON competition_school_exam_certificate_batch_items(certificate_batch_id);

-- Canonical migration 0077_competition_async_xlsx_export.sql
-- Competition V1 Task 17: retryable asynchronous XLSX export state.
-- The base export table was introduced in 0070. These columns make queue
-- processing recoverable without coupling workbook generation to exam requests.

ALTER TABLE competition_school_exam_exports ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0
  CHECK (attempt_count >= 0);
ALTER TABLE competition_school_exam_exports ADD COLUMN processing_started_at TEXT;
ALTER TABLE competition_school_exam_exports ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_school_exam_exports_processing
  ON competition_school_exam_exports(status, processing_started_at, requested_at);

-- Canonical migration 0078_competition_result_corrections.sql
-- Immutable correction ledger. Canonical rows may change only after this ledger
-- records the published before-state; publication snapshots remain immutable.

CREATE TABLE competition_school_exam_result_corrections (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  canonical_result_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  source_publication_id TEXT NOT NULL,
  source_publication_version INTEGER NOT NULL CHECK (source_publication_version > 0),
  before_score REAL NOT NULL CHECK (before_score >= 0 AND before_score <= 100),
  before_correct_count INTEGER CHECK (before_correct_count IS NULL OR before_correct_count >= 0),
  before_time_taken INTEGER CHECK (before_time_taken IS NULL OR before_time_taken >= 0),
  corrected_score REAL NOT NULL CHECK (corrected_score >= 0 AND corrected_score <= 100),
  corrected_correct_count INTEGER CHECK (corrected_correct_count IS NULL OR corrected_correct_count >= 0),
  corrected_time_taken INTEGER CHECK (corrected_time_taken IS NULL OR corrected_time_taken >= 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  request_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  before_hash TEXT NOT NULL CHECK (length(before_hash) = 64),
  after_hash TEXT NOT NULL CHECK (length(after_hash) = 64),
  applied_publication_id TEXT,
  applied_publication_version INTEGER CHECK (applied_publication_version IS NULL OR applied_publication_version > 0),
  applied_at TEXT,
  FOREIGN KEY (event_id) REFERENCES competition_school_exam_events(id) ON DELETE RESTRICT,
  FOREIGN KEY (canonical_result_id) REFERENCES competition_school_exam_results(id) ON DELETE RESTRICT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY (source_publication_id) REFERENCES competition_school_exam_publications(id) ON DELETE RESTRICT,
  FOREIGN KEY (applied_publication_id) REFERENCES competition_school_exam_publications(id) ON DELETE RESTRICT,
  UNIQUE(event_id, request_id)
);

CREATE INDEX idx_competition_result_corrections_event
  ON competition_school_exam_result_corrections(event_id, source_publication_version, created_at);

CREATE UNIQUE INDEX idx_competition_result_corrections_pending_student
  ON competition_school_exam_result_corrections(event_id, student_id)
  WHERE applied_publication_id IS NULL;

CREATE TRIGGER trg_competition_result_corrections_no_delete
BEFORE DELETE ON competition_school_exam_result_corrections
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_RESULT_CORRECTION_IMMUTABLE');
END;

CREATE TRIGGER trg_competition_result_corrections_immutable
BEFORE UPDATE ON competition_school_exam_result_corrections
WHEN OLD.id <> NEW.id
  OR OLD.event_id <> NEW.event_id
  OR OLD.canonical_result_id <> NEW.canonical_result_id
  OR OLD.student_id <> NEW.student_id
  OR OLD.source_publication_id <> NEW.source_publication_id
  OR OLD.source_publication_version <> NEW.source_publication_version
  OR OLD.before_score <> NEW.before_score
  OR OLD.before_correct_count IS NOT NEW.before_correct_count
  OR OLD.before_time_taken IS NOT NEW.before_time_taken
  OR OLD.corrected_score <> NEW.corrected_score
  OR OLD.corrected_correct_count IS NOT NEW.corrected_correct_count
  OR OLD.corrected_time_taken IS NOT NEW.corrected_time_taken
  OR OLD.reason <> NEW.reason
  OR OLD.request_id <> NEW.request_id
  OR OLD.created_by <> NEW.created_by
  OR OLD.created_at <> NEW.created_at
  OR OLD.before_hash <> NEW.before_hash
  OR OLD.after_hash <> NEW.after_hash
  OR OLD.applied_publication_id IS NOT NULL
  OR NEW.applied_publication_id IS NULL
  OR NEW.applied_publication_version IS NULL
  OR NEW.applied_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'SCHOOL_EXAM_RESULT_CORRECTION_IMMUTABLE');
END;
