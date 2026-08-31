-- Competition public portal presentation, content, and award configuration.
-- This aggregate references Competition core without changing its lifecycle data.

CREATE TABLE IF NOT EXISTS competition_public_pages (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
    CHECK (slug = lower(slug) AND length(slug) > 0),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PREVIEW', 'PUBLISHED', 'ARCHIVED')),
  hero_title TEXT NOT NULL,
  hero_subtitle TEXT,
  hero_image_url TEXT,
  summary TEXT,
  cta_label TEXT NOT NULL DEFAULT 'VÀO THI',
  seo_title TEXT,
  seo_description TEXT,
  og_image_url TEXT,
  published_at TEXT,
  archived_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  CHECK (status NOT IN ('PUBLISHED', 'ARCHIVED') OR published_at IS NOT NULL),
  CHECK (status <> 'ARCHIVED' OR archived_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS competition_articles (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL CHECK (slug = lower(slug) AND length(slug) > 0),
  summary TEXT,
  cover_image_url TEXT,
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN (
    'ANNOUNCEMENT', 'GUIDE', 'RULES', 'SCHEDULE', 'RESULT', 'AWARD',
    'CERTIFICATE', 'INCIDENT_NOTICE'
  )),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (campaign_id, slug),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  CHECK (status NOT IN ('PUBLISHED', 'ARCHIVED') OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS competition_award_rule_versions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  activated_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (campaign_id, version),
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competition_award_rules (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  scope TEXT NOT NULL CHECK (scope IN ('EVENT', 'GRADE')),
  grade_level INTEGER,
  rank_from INTEGER NOT NULL CHECK (rank_from > 0),
  rank_to INTEGER NOT NULL CHECK (rank_to >= rank_from),
  award_code TEXT NOT NULL CHECK (length(trim(award_code)) > 0),
  award_label TEXT NOT NULL CHECK (length(trim(award_label)) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (campaign_id, version, award_code),
  FOREIGN KEY (campaign_id, version)
    REFERENCES competition_award_rule_versions(campaign_id, version) ON DELETE CASCADE,
  CHECK (
    (scope = 'EVENT' AND grade_level IS NULL)
    OR (scope = 'GRADE' AND grade_level BETWEEN 1 AND 12)
  )
);

CREATE TABLE IF NOT EXISTS competition_golden_board_configs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL UNIQUE,
  source_event_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  display_mode TEXT NOT NULL DEFAULT 'AWARD_WINNERS'
    CHECK (display_mode = 'AWARD_WINNERS'),
  title TEXT NOT NULL,
  award_rule_version INTEGER CHECK (award_rule_version > 0),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES competition_campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (source_event_id) REFERENCES competition_school_exam_events(id) ON DELETE RESTRICT,
  FOREIGN KEY (campaign_id, award_rule_version)
    REFERENCES competition_award_rule_versions(campaign_id, version) ON DELETE RESTRICT,
  CHECK (enabled = 0 OR (source_event_id IS NOT NULL AND award_rule_version IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_competition_articles_campaign_status_published
  ON competition_articles(campaign_id, status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_competition_award_rules_version_scope_grade_rank
  ON competition_award_rules(campaign_id, version, scope, grade_level, rank_from, rank_to);

CREATE TRIGGER IF NOT EXISTS trg_competition_public_slug_immutable
BEFORE UPDATE OF slug ON competition_public_pages
WHEN NEW.slug <> OLD.slug
  AND (OLD.published_at IS NOT NULL OR OLD.status IN ('PUBLISHED', 'ARCHIVED'))
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_PUBLIC_SLUG_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_public_published_at_immutable
BEFORE UPDATE OF published_at ON competition_public_pages
WHEN OLD.published_at IS NOT NULL AND NEW.published_at IS NOT OLD.published_at
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_PUBLIC_PUBLISHED_AT_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_golden_board_source_insert
BEFORE INSERT ON competition_golden_board_configs
WHEN NEW.source_event_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM competition_school_exam_events
    WHERE id = NEW.source_event_id AND campaign_id = NEW.campaign_id
  )
BEGIN
  SELECT RAISE(ABORT, 'GOLDEN_BOARD_SOURCE_EVENT_CAMPAIGN_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_golden_board_source_update
BEFORE UPDATE OF campaign_id, source_event_id ON competition_golden_board_configs
WHEN NEW.source_event_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM competition_school_exam_events
    WHERE id = NEW.source_event_id AND campaign_id = NEW.campaign_id
  )
BEGIN
  SELECT RAISE(ABORT, 'GOLDEN_BOARD_SOURCE_EVENT_CAMPAIGN_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_golden_board_award_version_insert
BEFORE INSERT ON competition_golden_board_configs
WHEN NEW.enabled = 1
  AND NOT EXISTS (
    SELECT 1 FROM competition_award_rule_versions
    WHERE campaign_id = NEW.campaign_id
      AND version = NEW.award_rule_version
      AND status = 'ACTIVE'
  )
BEGIN
  SELECT RAISE(ABORT, 'GOLDEN_BOARD_AWARD_VERSION_NOT_ACTIVE');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_golden_board_award_version_update
BEFORE UPDATE OF campaign_id, award_rule_version, enabled ON competition_golden_board_configs
WHEN NEW.enabled = 1
  AND NOT EXISTS (
    SELECT 1 FROM competition_award_rule_versions
    WHERE campaign_id = NEW.campaign_id
      AND version = NEW.award_rule_version
      AND status = 'ACTIVE'
  )
BEGIN
  SELECT RAISE(ABORT, 'GOLDEN_BOARD_AWARD_VERSION_NOT_ACTIVE');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_award_version_activate_no_overlap
BEFORE UPDATE OF status ON competition_award_rule_versions
WHEN OLD.status = 'DRAFT' AND NEW.status = 'ACTIVE'
  AND EXISTS (
    SELECT 1
    FROM competition_award_rules first_rule
    JOIN competition_award_rules second_rule
      ON second_rule.campaign_id = first_rule.campaign_id
      AND second_rule.version = first_rule.version
      AND second_rule.id > first_rule.id
      AND second_rule.scope = first_rule.scope
      AND second_rule.grade_level IS first_rule.grade_level
      AND second_rule.rank_from <= first_rule.rank_to
      AND second_rule.rank_to >= first_rule.rank_from
    WHERE first_rule.campaign_id = OLD.campaign_id
      AND first_rule.version = OLD.version
  )
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AWARD_RULE_RANGES_OVERLAP');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_award_version_update_immutable
BEFORE UPDATE ON competition_award_rule_versions
WHEN OLD.status IN ('ACTIVE', 'RETIRED')
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AWARD_VERSION_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_award_version_delete_immutable
BEFORE DELETE ON competition_award_rule_versions
WHEN OLD.status IN ('ACTIVE', 'RETIRED')
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AWARD_VERSION_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_award_rule_insert_immutable
BEFORE INSERT ON competition_award_rules
WHEN EXISTS (
  SELECT 1 FROM competition_award_rule_versions
  WHERE campaign_id = NEW.campaign_id AND version = NEW.version
    AND status IN ('ACTIVE', 'RETIRED')
)
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AWARD_RULE_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_award_rule_update_immutable
BEFORE UPDATE ON competition_award_rules
WHEN EXISTS (
  SELECT 1 FROM competition_award_rule_versions
  WHERE campaign_id = OLD.campaign_id AND version = OLD.version
    AND status IN ('ACTIVE', 'RETIRED')
)
OR EXISTS (
  SELECT 1 FROM competition_award_rule_versions
  WHERE campaign_id = NEW.campaign_id AND version = NEW.version
    AND status IN ('ACTIVE', 'RETIRED')
)
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AWARD_RULE_IMMUTABLE');
END;

CREATE TRIGGER IF NOT EXISTS trg_competition_award_rule_delete_immutable
BEFORE DELETE ON competition_award_rules
WHEN EXISTS (
  SELECT 1 FROM competition_award_rule_versions
  WHERE campaign_id = OLD.campaign_id AND version = OLD.version
    AND status IN ('ACTIVE', 'RETIRED')
)
BEGIN
  SELECT RAISE(ABORT, 'COMPETITION_AWARD_RULE_IMMUTABLE');
END;

-- Generate URL-safe slugs character-by-character so the backfill is deterministic
-- using only SQLite built-ins. Duplicate normalized bases keep the lowest campaign
-- id unsuffixed; later ids receive a stable hexadecimal suffix derived from id.
WITH RECURSIVE
campaign_sources AS (
  SELECT id, title, school_year, title || '-' || school_year AS source
  FROM competition_campaigns
),
slug_chars(campaign_id, position, slug) AS (
  SELECT id, 1, '' FROM campaign_sources
  UNION ALL
  SELECT
    slug_chars.campaign_id,
    slug_chars.position + 1,
    slug_chars.slug || CASE
      WHEN instr('aáàảãạăắằẳẵặâấầẩẫậ' || char(193,192,7842,195,7840,258,7854,7856,7858,7860,7862,194,7844,7846,7848,7850,7852), substr(campaign_sources.source, slug_chars.position, 1)) > 0 THEN 'a'
      WHEN instr('eéèẻẽẹêếềểễệ' || char(201,200,7866,7868,7864,202,7870,7872,7874,7876,7878), substr(campaign_sources.source, slug_chars.position, 1)) > 0 THEN 'e'
      WHEN instr('iíìỉĩị' || char(205,204,7880,296,7882), substr(campaign_sources.source, slug_chars.position, 1)) > 0 THEN 'i'
      WHEN instr('oóòỏõọôốồổỗộơớờởỡợ' || char(211,210,7886,213,7884,212,7888,7890,7892,7894,7896,416,7898,7900,7902,7904,7906), substr(campaign_sources.source, slug_chars.position, 1)) > 0 THEN 'o'
      WHEN instr('uúùủũụưứừửữự' || char(218,217,7910,360,7908,431,7912,7914,7916,7918,7920), substr(campaign_sources.source, slug_chars.position, 1)) > 0 THEN 'u'
      WHEN instr('yýỳỷỹỵ' || char(221,7922,7926,7928,7924), substr(campaign_sources.source, slug_chars.position, 1)) > 0 THEN 'y'
      WHEN instr('dđ' || char(272), substr(campaign_sources.source, slug_chars.position, 1)) > 0 THEN 'd'
      WHEN lower(substr(campaign_sources.source, slug_chars.position, 1)) GLOB '[a-z0-9]'
        THEN lower(substr(campaign_sources.source, slug_chars.position, 1))
      ELSE '-'
    END
  FROM slug_chars
  JOIN campaign_sources ON campaign_sources.id = slug_chars.campaign_id
  WHERE slug_chars.position <= length(campaign_sources.source)
),
raw_slugs AS (
  SELECT campaign_id, slug
  FROM slug_chars
  JOIN campaign_sources ON campaign_sources.id = slug_chars.campaign_id
  WHERE position = length(campaign_sources.source) + 1
),
compact_slugs(campaign_id, slug) AS (
  SELECT campaign_id, slug FROM raw_slugs
  UNION ALL
  SELECT campaign_id, replace(slug, '--', '-')
  FROM compact_slugs
  WHERE instr(slug, '--') > 0
),
base_slugs AS (
  SELECT campaign_id, trim(slug, '-') AS base_slug
  FROM compact_slugs
  WHERE instr(slug, '--') = 0
),
backfill AS (
  SELECT
    campaign.id AS campaign_id,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM base_slugs other
        WHERE other.base_slug = base_slugs.base_slug
          AND other.campaign_id < campaign.id
      ) OR EXISTS (
        SELECT 1 FROM competition_public_pages existing
        WHERE existing.slug = base_slugs.base_slug
          AND existing.campaign_id <> campaign.id
      )
      THEN base_slugs.base_slug || '-' || lower(hex(campaign.id))
      ELSE base_slugs.base_slug
    END AS slug
  FROM competition_campaigns campaign
  JOIN base_slugs ON base_slugs.campaign_id = campaign.id
)
INSERT INTO competition_public_pages (
  id, campaign_id, slug, status, hero_title, created_by, created_at, updated_at
)
SELECT
  'competition-public-page-' || lower(hex(campaign.id)),
  campaign.id,
  backfill.slug,
  'DRAFT',
  campaign.title,
  campaign.created_by,
  campaign.created_at,
  campaign.updated_at
FROM competition_campaigns campaign
JOIN backfill ON backfill.campaign_id = campaign.id
WHERE NOT EXISTS (
  SELECT 1 FROM competition_public_pages existing
  WHERE existing.campaign_id = campaign.id
);

INSERT OR IGNORE INTO feature_flags (
  flag_key, description, enabled, owner, version, created_at, updated_at
) VALUES
  ('competition_public_portal_read_v1', 'Competition public portal read routes and API', 0, 'competition', 1, datetime('now'), datetime('now')),
  ('competition_student_portal_v1', 'Competition dedicated student portal', 0, 'competition', 1, datetime('now'), datetime('now')),
  ('competition_legacy_redirect_v1', 'Competition legacy route redirect', 0, 'competition', 1, datetime('now'), datetime('now')),
  ('competition_golden_board_v1', 'Competition Golden Board publication', 0, 'competition', 1, datetime('now'), datetime('now')),
  ('competition_public_content_admin_v1', 'Competition public content administration', 0, 'competition', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO feature_flag_rules (
  flag_key, audience, percentage, allow_users_json, allow_classes_json,
  starts_at, ends_at, stop_conditions_json, reason, updated_by, updated_at
) VALUES
  ('competition_public_portal_read_v1', 'all', 100, '[]', '[]', NULL, NULL, '{}', 'Competition portal rollout seed', 'migration-0080', datetime('now')),
  ('competition_student_portal_v1', 'all', 100, '[]', '[]', NULL, NULL, '{}', 'Competition portal rollout seed', 'migration-0080', datetime('now')),
  ('competition_legacy_redirect_v1', 'all', 100, '[]', '[]', NULL, NULL, '{}', 'Competition portal rollout seed', 'migration-0080', datetime('now')),
  ('competition_golden_board_v1', 'all', 100, '[]', '[]', NULL, NULL, '{}', 'Competition portal rollout seed', 'migration-0080', datetime('now')),
  ('competition_public_content_admin_v1', 'all', 100, '[]', '[]', NULL, NULL, '{}', 'Competition portal rollout seed', 'migration-0080', datetime('now'));

INSERT OR IGNORE INTO system_settings (setting_key, setting_value, updated_at)
VALUES ('school_name', 'Trường Tiểu học Tô Hiệu', datetime('now'));
