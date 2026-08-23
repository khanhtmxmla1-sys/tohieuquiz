-- Competition V1 remains inaccessible until an audited cohort rollout enables
-- this runtime control-plane flag. The Vite build flag is an outer kill switch;
-- both gates must allow access.
INSERT OR IGNORE INTO feature_flags (
  flag_key, description, enabled, owner, version, created_at, updated_at
) VALUES (
  'competition_v1', 'Competition V1 cohort rollout', 0, 'competition-platform',
  1, datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO feature_flag_rules (
  flag_key, audience, percentage, allow_users_json, allow_classes_json,
  starts_at, ends_at, stop_conditions_json, reason, updated_by, updated_at
) VALUES (
  'competition_v1', 'all', 0, '[]', '[]', NULL, NULL,
  '{"max5xxRatePercent":1,"maxClientErrorMultiplier":2,"maxP95IncreasePercent":30}',
  'Competition V1 starts disabled and requires audited cohort promotion',
  'migration-0079', datetime('now')
);
