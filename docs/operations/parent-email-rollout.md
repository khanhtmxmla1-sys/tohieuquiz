# Parent email rollout

Parent email is disabled by default. The Worker must not send verification, recovery or weekly digest messages until the provider and the sending domain are ready.

## Required gate

All of the following must be true before rollout:

- `PARENT_EMAIL_PROVIDER=http`
- `PARENT_EMAIL_API_URL` points to an HTTPS provider endpoint.
- `PARENT_EMAIL_API_TOKEN` is stored as a Worker secret, never in source control or frontend variables.
- `PARENT_EMAIL_FROM` uses the verified sending domain.
- `PARENT_EMAIL_PUBLIC_BASE_URL` points to the Parent Portal origin.
- `PARENT_EMAIL_SPF_READY=true`
- `PARENT_EMAIL_DKIM_READY=true`
- `PARENT_EMAIL_DMARC_READY=true`

Keep the three authentication flags false until DNS checks and a provider test message confirm SPF alignment, DKIM signing and DMARC alignment. The provider adapter fails closed when any flag or required value is missing.

## Privacy contract

Weekly digest storage and delivery may contain only:

- week start/end;
- aggregate completion and score metrics;
- up to three support areas with confidence;
- up to three short home suggestions.

Do not include student name, class, email, result IDs, assignment IDs, question text or answers in `parent_digest_runs.payload_json` or the message body. The destination email exists only in contact preferences and the provider request.

Verification and recovery tokens are stored only as SHA-256 hashes. Verification tokens expire after 24 hours; recovery tokens expire after 30 minutes. Both are single-use. A successful PIN reset increments `parent_links.token_version`, invalidating previous parent sessions.

## Rollout and rollback

1. Apply migration `0048_parent_digest_recovery.sql`.
2. Configure the provider URL, sender and public portal URL.
3. Add `PARENT_EMAIL_API_TOKEN` with `wrangler secret put`; never place it in `wrangler.toml`.
4. Verify SPF, DKIM and DMARC externally, then enable the three readiness flags.
5. Enable the HTTP provider and run a verification-email smoke test with a controlled parent link.
6. Confirm the hourly cron creates at most one `parent_digest_runs` row per parent/week.

Emergency rollback: set `PARENT_EMAIL_PROVIDER=disabled` or any readiness flag to `false`. This immediately blocks new sends without deleting preferences or tokens. Database rollback is normally unnecessary; if required, use `0048_drop_parent_digest_recovery.sql` after preserving audit evidence.
