# Staged rollout and production smoke

## Safety boundary

The production workflow is read-only for business data. It may create short-lived authentication sessions for dedicated smoke accounts, but it does not create classes, students, results, certificates, queue messages, or AI generations.

Queue and certificate mutation smoke is permitted only in a dedicated `staging` or `test` namespace. The production workflow has no mutation endpoint or deploy command. AI rollout smoke is also read-only: it verifies the teacher quota endpoint and the runtime feature-resolution endpoint.

Create a protected GitHub Environment named `production-smoke` and configure these secrets:

- `SMOKE_ADMIN_USERNAME`, `SMOKE_ADMIN_PASSWORD`
- `SMOKE_TEACHER_USERNAME`, `SMOKE_TEACHER_PASSWORD`
- `SMOKE_STUDENT_USERNAME`, `SMOKE_STUDENT_PASSWORD`
- `SMOKE_PARENT_ACCESS_CODE`, `SMOKE_PARENT_PIN`

Use dedicated active accounts that do not require a password change. Never use owner credentials. Secrets are passed only as environment variables; they are never CLI arguments or report fields.

## Production smoke coverage

The workflow checks:

- apex, canonical site, parent portal and direct API domains;
- HSTS, CSP, `nosniff`, immutable assets and browser runtime errors;
- same-origin API rewrite, direct health, exact allowed CORS and hostile-origin rejection;
- unauthenticated guards for admin, teacher, student and parent routes;
- one authenticated read path per role: Operations Center, Action Center, student profile and parent dashboard;
- optional read-only AI readiness during an AI rollout.

Reports are written to `reports/production-smoke.json`. Reports contain only origins, check identifiers, durations, status and sanitized error summaries. Browser screenshots cover public pages only.

## Rollout sequence

Apply one stage at a time:

1. `admin-only` — admin audience, 100%, observe for at least 24 hours.
2. `teachers-5` — teacher audience, 5%, observe for at least 24 hours.
3. `pilot-class` — one explicit class allowlist, observe for at least 48 hours.
4. `teachers-25` — teacher audience, 25%, observe for at least 24 hours.
5. `full` — all audiences, 100%, observe for at least 48 hours.

The staged-rollout CLI currently uses the backward-compatible single-field PATCH API and sends exactly one field per PATCH. If a later PATCH fails, it compensates already-applied fields back to the captured pre-stage values. Every change and compensation remains audited by the control plane.

The admin Feature Rollout page uses a different write path for one logical manual edit: `PATCH /api/system-settings/feature-flags/:key/batch`. That endpoint accepts the complete `changes` set plus an audit `reason` and `expectedVersion`, validates the whole batch before mutation, increments the version once, and writes one `__batch__` before/after audit record. Do not emulate an unavailable batch endpoint from the UI by firing several single-field PATCH requests; reload/report the failure instead. The existing single-field endpoint remains intentionally supported for this staged-rollout script and backward compatibility.

## Stop conditions

A stage is blocked immediately when any condition is true:

- 5xx rate is greater than 1%;
- client errors are greater than 2 times baseline;
- p95 latency is greater than 30% above baseline;
- any data-corruption signal is present;
- any authentication anomaly is present.

A healthy stage remains `observing` until its minimum 24–48 hour window is complete. Only then may it become `ready` for the next stage.

## Rollback

Use the workflow action `rollout-rollback` with the current stage. The script deterministically applies the previous stage configuration through audited single-field PATCH requests. For an evaluation run, `auto_rollback=true` applies the same rollback when a stop condition is breached.

For a manual rollback initiated from the admin Feature Rollout page, use the control-plane endpoint `POST /api/system-settings/feature-flags/:key/rollback` with a required audit reason. This restores the audited prior configuration for that flag and is separate from the staged-rollout CLI's stage-based rollback logic.

After rollback:

1. run production smoke again;
2. verify Operations Center and alert metrics;
3. preserve the redacted rollout report;
4. do not advance until the incident owner records the cause and a new observation window is approved.

## Local plan and evaluation

```bash
npm run rollout:staged -- \
  --action plan \
  --flag unified_notifications_v1 \
  --stage teachers-5 \
  --site https://www.thtohieu.com \
  --api https://api.thtohieu.com \
  --output reports/staged-rollout.json
```

Evaluation accepts a JSON metrics file containing `error5xxRatePercent`, `clientErrorRate`, `baselineClientErrorRate`, `p95Ms`, `baselineP95Ms`, `dataCorruption`, and `authAnomaly`.
