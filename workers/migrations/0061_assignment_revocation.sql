-- Safe, auditable withdrawal of quiz assignments before any completed submission.
ALTER TABLE assignments ADD COLUMN revoked_at TEXT;
ALTER TABLE assignments ADD COLUMN revoked_by TEXT;
ALTER TABLE assignments ADD COLUMN revoked_reason TEXT;
ALTER TABLE assignments ADD COLUMN previous_status TEXT;
ALTER TABLE assignments ADD COLUMN submission_count_at_revoke INTEGER NOT NULL DEFAULT 0;
