-- Migration: Add tags column to quizzes table
-- Date: 2026-03-11
-- Purpose: Support teacher quiz categorization & tagging system
--
-- Note: column 'category' already exists (TEXT, default '')
-- This migration adds 'tags' column for flexible hashtag-based tagging

ALTER TABLE quizzes ADD COLUMN tags TEXT DEFAULT '[]';

-- Backfill: ensure all existing quizzes have valid category
-- Current data uses 'on-tap' as default category value
-- UPDATE quizzes SET category = 'toan' WHERE category = '' OR category IS NULL;
