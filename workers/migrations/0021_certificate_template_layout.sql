ALTER TABLE certificate_templates ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1));
ALTER TABLE certificate_templates ADD COLUMN canvas_width INTEGER NOT NULL DEFAULT 1200 CHECK(canvas_width > 0);
ALTER TABLE certificate_templates ADD COLUMN canvas_height INTEGER NOT NULL DEFAULT 848 CHECK(canvas_height > 0);

CREATE INDEX IF NOT EXISTS idx_templates_default ON certificate_templates(is_default, is_active);
