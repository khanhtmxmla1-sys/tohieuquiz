# TôHiệuQuiz maintenance calendar

**Timezone:** `Asia/Ho_Chi_Minh` (UTC+7)  
**Effective from:** 2026-07-30

This calendar defines the minimum recurring operational checks after the modernization release. Each run must produce a redacted record with date, operator, release SHA, result, follow-up owner and incident link when applicable.


## Automated Worker schedule

Cloudflare cron expressions are UTC; operational labels below are Hanoi time
(`Asia/Ho_Chi_Minh`). The source of truth is
`workers/src/scheduling/systemCron.ts` and `workers/wrangler.toml`.

| UTC cron | Hanoi schedule | Automated work |
|---|---|---|
| `0 0 * * 1` | Thứ Hai 07:00 giờ Hà Nội | Close expired exams and award the previous Hanoi leaderboard week. |
| `* * * * *` | Mỗi phút theo giờ Hà Nội | Sweep and close expired live exams. |
| `0 23 * * *` | Hằng ngày 06:00 giờ Hà Nội | Purge expired rate-limit/auth rows and create parent homework reminders. |
| `0 * * * *` | Mỗi giờ đúng phút 00 giờ Hà Nội | Evaluate weekly parent digest delivery preferences. |

Cron timestamps in logs remain UTC ISO-8601. Incident and operator reports must
show Hanoi time through the shared formatter rather than altering stored values.

## Weekly

### Security and dependency review — Monday 08:00

Owner: platform/security maintainer.

- Run `npm run security:check` on current `main`.
- Review Dependabot pull requests individually; do not batch major upgrades.
- Confirm branch protection still requires PR review, CODEOWNERS, strict required checks and conversation resolution.
- Review new critical/action-required security events and unusual login failures.
- Confirm Worker secrets are present by name without reading or exporting their values.

### AI and R2 cost/capacity review — Friday 16:00

Owner: platform operations.

- Review AI request volume, quota rejection rate, upstream failures and cost trend.
- Review R2 object count/storage growth for certificate and public-asset buckets.
- Review Queue/DLQ backlog, certificate processing failures and retry count.
- Record the comparison against the previous four-week baseline.

## Monthly

### Backup verification — first business day, 09:00

Owner: database operations.

- Capture a current D1 Time Travel bookmark and store the full value outside Git.
- Run the tablewise encrypted backup using an environment-only passphrase and a destination outside the repository.
- Verify archive checksum, schema fingerprint, regular-table count and absence of plaintext SQL.
- Confirm the latest backup can be located and its recovery instructions are still valid.
- Do not restore into production during this check.

### Production access review — first business day, 14:00

Owner: system owner.

- Review active admin/teacher accounts and dedicated smoke accounts.
- Review active sessions, passkeys and account-recovery events.
- Revoke obsolete sessions and disable abandoned accounts through reviewed application flows.
- Confirm no ad-hoc test account or test class has returned.

## Quarterly

### Full restore rehearsal — first Monday of January, April, July and October, 09:00

Owner: database operations with release owner review.

- Use a dedicated isolated staging D1 database only.
- Restore the latest encrypted backup and separately rehearse Time Travel recovery.
- Rebuild FTS from canonical source data.
- Verify schema/index/trigger fingerprint, row counts, FTS parity and authenticated HTTP smoke.
- Record observed RPO/RTO and any runbook correction.
- Destroy temporary staging markers and credentials after evidence capture.

## After every production release

Owner: release manager.

- Confirm source SHA, Vercel deployment and Worker version.
- Run the read-only production smoke for admin, teacher, student and parent.
- Check health, expected 401/403 guards, observed 5xx and protected-route latency.
- Review D1 security events and newly created auth sessions.
- Record rollback versions/bookmarks before closing the release.

## Escalation

Open an incident and stop further rollout when any of these occur:

- confirmed data corruption or cross-role authorization failure;
- production 5xx above 1% for the observed window;
- client errors above twice the established baseline;
- protected-route p95 latency more than 30% above baseline;
- authentication anomaly, Queue/DLQ growth or certificate failure without a bounded recovery path;
- backup verification or restore rehearsal failure.
