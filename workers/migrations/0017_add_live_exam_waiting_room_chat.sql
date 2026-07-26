ALTER TABLE live_exam_sessions ADD COLUMN chat_enabled INTEGER NOT NULL DEFAULT 1;

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