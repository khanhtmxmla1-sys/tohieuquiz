-- Migration 0016: Add Live Exam Session tables
-- Date: 2026-05-05
-- Related: CONTEXT.md, ADR-0001, ADR-0002

-- ============================================================================
-- Table 1: live_exam_sessions
-- Stores Live Exam Session metadata and state
-- ============================================================================
CREATE TABLE IF NOT EXISTS live_exam_sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  class_id TEXT,
  
  -- Timing
  duration INTEGER NOT NULL,        -- Duration in minutes
  scheduled_at TEXT,                -- ISO 8601 timestamp (optional)
  started_at TEXT,                  -- When exam actually started
  ends_at TEXT,                     -- Calculated: started_at + duration
  closed_at TEXT,                   -- When teacher/system closed session
  
  -- Settings (JSON)
  settings TEXT NOT NULL DEFAULT '{}',
  
  -- State machine: 'scheduled' | 'waiting' | 'active' | 'scoring' | 'closed'
  status TEXT NOT NULL DEFAULT 'scheduled',
  
  -- Access
  access_code TEXT NOT NULL UNIQUE, -- 6-digit code (e.g., "ABC123")
  
  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES teachers(username) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);

-- Indexes for performance (polling queries)
CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_access_code 
  ON live_exam_sessions(access_code);
  
CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_status 
  ON live_exam_sessions(status);
  
CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_teacher 
  ON live_exam_sessions(teacher_id, status);
  
CREATE INDEX IF NOT EXISTS idx_live_exam_sessions_class 
  ON live_exam_sessions(class_id, status);

-- ============================================================================
-- Table 2: live_exam_participants
-- Stores student participation and answers
-- ============================================================================
CREATE TABLE IF NOT EXISTS live_exam_participants (
  id TEXT PRIMARY KEY,
  live_exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  username TEXT NOT NULL,           -- Denormalized for display
  
  -- Timing
  joined_at TEXT NOT NULL,          -- When student joined waiting room
  started_at TEXT,                  -- When student started exam
  submitted_at TEXT,                -- When student submitted (or auto-submitted)
  
  -- Answers (JSON): {"1": "A", "2": "B", "3": "C"}
  answers TEXT,
  
  -- Results (calculated after session closes)
  score INTEGER,                    -- Total score (0-100)
  correct_count INTEGER,            -- Number of correct answers
  wrong_count INTEGER,              -- Number of wrong answers
  rank INTEGER,                     -- Rank within this session (1 = best)
  
  -- Anti-cheat tracking
  tab_switches INTEGER DEFAULT 0,   -- Number of times student switched tabs
  warnings TEXT,                    -- JSON array of warning events
  
  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  
  UNIQUE(live_exam_id, student_id)  -- One participation per student per session
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_live_exam_participants_session 
  ON live_exam_participants(live_exam_id);
  
CREATE INDEX IF NOT EXISTS idx_live_exam_participants_student 
  ON live_exam_participants(student_id);
  
CREATE INDEX IF NOT EXISTS idx_live_exam_participants_rank 
  ON live_exam_participants(live_exam_id, rank);

-- ============================================================================
-- Table 3: live_exam_activity
-- Lightweight table for real-time status updates (polling optimization)
-- ============================================================================
CREATE TABLE IF NOT EXISTS live_exam_activity (
  live_exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  
  -- Current state
  current_question INTEGER,         -- Which question student is on (1-based)
  answered_count INTEGER,           -- How many questions answered so far
  last_activity TEXT NOT NULL,      -- ISO 8601 timestamp of last action
  is_online INTEGER DEFAULT 1,      -- 0 if student hasn't polled in 10+ seconds
  
  PRIMARY KEY (live_exam_id, student_id),
  FOREIGN KEY (live_exam_id) REFERENCES live_exam_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Index for teacher dashboard queries
CREATE INDEX IF NOT EXISTS idx_live_exam_activity_session 
  ON live_exam_activity(live_exam_id, is_online);
