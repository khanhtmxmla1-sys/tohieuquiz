-- Migration: Add Live Exam Analytics Tables
-- Purpose: Track question-level analytics and student timing data for live exams
-- Created: 2026-05-07

-- Table: live_exam_question_analytics
-- Stores aggregated analytics per question per session
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

-- Table: live_exam_student_timing
-- Stores individual student timing data per question
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
