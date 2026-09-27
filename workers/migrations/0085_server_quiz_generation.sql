-- Server-owned quiz generation orchestrator rollout and bounded diagnostics.
-- The feature is disabled by default and can be rolled back by disabling the flag.

ALTER TABLE ai_generation_actions
  ADD COLUMN orchestrator_version TEXT;

ALTER TABLE ai_generation_actions
  ADD COLUMN provider_attempts INTEGER NOT NULL DEFAULT 0
    CHECK (provider_attempts >= 0 AND provider_attempts <= 99);

ALTER TABLE ai_generation_actions
  ADD COLUMN last_provider_error_code TEXT;

ALTER TABLE ai_generation_actions
  ADD COLUMN last_provider_status INTEGER
    CHECK (
      last_provider_status IS NULL
      OR (last_provider_status >= 100 AND last_provider_status <= 599)
    );

ALTER TABLE ai_generation_actions
  ADD COLUMN last_provider_phase TEXT
    CHECK (
      last_provider_phase IS NULL
      OR last_provider_phase IN (
        'validation', 'redirect', 'upstream', 'network', 'timeout',
        'response-size', 'response-json', 'response-content'
      )
    );

INSERT OR IGNORE INTO feature_flags (
  flag_key, description, enabled, owner, version, created_at, updated_at
) VALUES (
  'server_quiz_generation_v1',
  'Server-owned quiz generation orchestrator and rule engine',
  0,
  'ai-platform',
  1,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO feature_flag_rules (
  flag_key, audience, percentage, allow_users_json, allow_classes_json,
  starts_at, ends_at, stop_conditions_json, reason, updated_by, updated_at
) VALUES (
  'server_quiz_generation_v1', 'teacher', 0, '[]', '[]', NULL, NULL,
  '{"max5xxRatePercent":1}',
  'Server quiz generation stays disabled until canary verification is approved',
  'migration-0085',
  datetime('now')
);
