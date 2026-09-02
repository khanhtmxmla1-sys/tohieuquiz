-- Remove only Competition public portal-owned objects and rollout seeds.
-- school_name is deliberately retained because this migration cannot prove ownership.

DROP TRIGGER IF EXISTS trg_competition_award_rule_delete_immutable;
DROP TRIGGER IF EXISTS trg_competition_award_rule_update_immutable;
DROP TRIGGER IF EXISTS trg_competition_award_rule_insert_immutable;
DROP TRIGGER IF EXISTS trg_competition_award_version_delete_immutable;
DROP TRIGGER IF EXISTS trg_competition_award_version_update_immutable;
DROP TRIGGER IF EXISTS trg_competition_award_version_activate_no_overlap;
DROP TRIGGER IF EXISTS trg_competition_golden_board_award_version_update;
DROP TRIGGER IF EXISTS trg_competition_golden_board_award_version_insert;
DROP TRIGGER IF EXISTS trg_competition_golden_board_source_update;
DROP TRIGGER IF EXISTS trg_competition_golden_board_source_insert;
DROP TRIGGER IF EXISTS trg_competition_public_published_at_immutable;
DROP TRIGGER IF EXISTS trg_competition_public_slug_immutable;

DROP TABLE IF EXISTS competition_golden_board_configs;
DROP TABLE IF EXISTS competition_award_rules;
DROP TABLE IF EXISTS competition_award_rule_versions;
DROP TABLE IF EXISTS competition_articles;
DROP TABLE IF EXISTS competition_public_pages;

DELETE FROM feature_flags
WHERE flag_key IN (
  'competition_public_portal_read_v1',
  'competition_student_portal_v1',
  'competition_legacy_redirect_v1',
  'competition_golden_board_v1',
  'competition_public_content_admin_v1'
);
