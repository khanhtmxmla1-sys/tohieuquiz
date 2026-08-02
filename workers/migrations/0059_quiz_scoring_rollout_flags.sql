-- Safe rollout controls for canonical quiz scoring.
-- Compatibility mode still uses the canonical engine; these flags control
-- rollout observability and canonical answer-contract expectations only.
INSERT OR IGNORE INTO feature_flags (
  flag_key, description, enabled, owner, version, created_at, updated_at
) VALUES
  ('quiz_scoring_canonical_v2', 'Canonical quiz scoring and answer contract V2', 1, 'assessment-platform', 1, datetime('now'), datetime('now')),
  ('quiz_scoring_shadow_v2', 'Privacy-safe shadow comparison for quiz scoring V2', 0, 'assessment-platform', 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO feature_flag_rules (
  flag_key, audience, percentage, allow_users_json, allow_classes_json,
  starts_at, ends_at, stop_conditions_json, reason, updated_by, updated_at
) VALUES
  ('quiz_scoring_canonical_v2', 'all', 100, '[]', '[]', NULL, NULL,
   '{"max5xxRatePercent":1,"maxClientErrorMultiplier":1.5,"maxP95IncreasePercent":30}',
   'Canonical engine is authoritative; percentage may be reduced without restoring the faulty legacy grader',
   'migration-0059', datetime('now')),
  ('quiz_scoring_shadow_v2', 'all', 100, '[]', '[]', NULL, NULL,
   '{"max5xxRatePercent":1,"maxClientErrorMultiplier":2,"maxP95IncreasePercent":40}',
   'Enable only while comparing client metadata with authoritative canonical results',
   'migration-0059', datetime('now'));
