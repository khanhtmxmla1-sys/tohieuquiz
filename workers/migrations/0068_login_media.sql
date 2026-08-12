-- Login page media module: safe CONTENT fallback + ordered Cloudinary slide metadata.
CREATE TABLE IF NOT EXISTS login_media_settings (
  id TEXT PRIMARY KEY,
  display_mode TEXT NOT NULL DEFAULT 'CONTENT'
    CHECK (display_mode IN ('CONTENT', 'SLIDER')),
  autoplay INTEGER NOT NULL DEFAULT 1 CHECK (autoplay IN (0, 1)),
  interval_ms INTEGER NOT NULL DEFAULT 5000 CHECK (interval_ms BETWEEN 2000 AND 30000),
  transition TEXT NOT NULL DEFAULT 'FADE'
    CHECK (transition IN ('FADE', 'SLIDE')),
  show_dots INTEGER NOT NULL DEFAULT 1 CHECK (show_dots IN (0, 1)),
  show_arrows INTEGER NOT NULL DEFAULT 1 CHECK (show_arrows IN (0, 1)),
  pause_on_hover INTEGER NOT NULL DEFAULT 1 CHECK (pause_on_hover IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

INSERT OR IGNORE INTO login_media_settings (
  id, display_mode, autoplay, interval_ms, transition,
  show_dots, show_arrows, pause_on_hover, version, updated_at, updated_by
) VALUES (
  'default', 'CONTENT', 1, 5000, 'FADE',
  1, 1, 1, 1, datetime('now'), NULL
);

CREATE TABLE IF NOT EXISTS login_media_slides (
  id TEXT PRIMARY KEY,
  cloudinary_public_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_width INTEGER CHECK (image_width IS NULL OR image_width > 0),
  image_height INTEGER CHECK (image_height IS NULL OR image_height > 0),
  alt_text TEXT NOT NULL DEFAULT '',
  internal_title TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  open_new_tab INTEGER NOT NULL DEFAULT 0 CHECK (open_new_tab IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_login_media_slides_active_order
  ON login_media_slides(enabled, sort_order, starts_at, ends_at);
