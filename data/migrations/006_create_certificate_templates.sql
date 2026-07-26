-- Migration: Create certificate_templates table
-- Date: 2026-07-14

CREATE TABLE IF NOT EXISTS certificate_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    background_image_key TEXT NOT NULL,
    fields_config TEXT,                    -- JSON config for text/QR positions
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_certificate_templates_active 
ON certificate_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_certificate_templates_created_by 
ON certificate_templates(created_by);