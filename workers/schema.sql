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
  tags TEXT DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);

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
  image_alt TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_questions_tags ON questions(tags);

-- Results
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT,
  assignment_id TEXT,
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
  analytics_json TEXT DEFAULT '[]'
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
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_results_assignment_student
  ON results(assignment_id, student_id, submitted_at);

-- User Pets (Gamification)
CREATE TABLE IF NOT EXISTS user_pets (
  username TEXT PRIMARY KEY,
  pet_id TEXT DEFAULT 'cat_01',
  pet_name TEXT DEFAULT 'Mèo Con',
  level INTEGER DEFAULT 1,
  exp INTEGER DEFAULT 0,
  exp_to_next INTEGER DEFAULT 100,
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
  file_urls TEXT DEFAULT '[]', -- JSON array of image links (Cloudinary)
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
  action TEXT NOT NULL CHECK (action IN ('GROUP_CREATED', 'NOTE_CREATED', 'ASSIGNMENT_BATCH_CREATED')),
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
