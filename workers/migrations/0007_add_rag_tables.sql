-- RAG v1 schema for help chatbot

CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY,
  source_path TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  checksum TEXT NOT NULL,
  chunk_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

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

CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
  chunk_id UNINDEXED,
  source_path,
  title,
  section_title,
  content,
  tokenize = 'unicode61'
);

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

CREATE INDEX IF NOT EXISTS idx_rag_documents_source_path ON rag_documents(source_path);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_chunk_index ON rag_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS idx_rag_logs_created_at ON rag_query_logs(created_at DESC);
