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
  created_at TEXT NOT NULL,
  archived_at TEXT
);

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
  updated_at TEXT NOT NULL
);

-- Gift Shop Orders
CREATE TABLE IF NOT EXISTS gift_orders (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  item_snapshot TEXT NOT NULL,
  price_coins INTEGER NOT NULL,
  status TEXT NOT NULL,
  voucher_code TEXT NOT NULL,
  delivered_by TEXT DEFAULT '',
  delivered_at TEXT DEFAULT '',
  cancel_reason TEXT DEFAULT '',
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
  created_at TEXT NOT NULL
);

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
  action_url TEXT,
  source_type TEXT,
  source_id TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, user_role, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_inbox
  ON notifications(user_id, user_role, is_read, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source_dedupe
  ON notifications(user_id, user_role, source_type, source_id, type)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

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
