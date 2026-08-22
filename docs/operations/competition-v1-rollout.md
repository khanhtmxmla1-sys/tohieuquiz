# Competition V1 rollout and rollback

Competition V1 stays disabled until its regression suite, migration rehearsal, capacity certification, and stubbed E2E journey are green for the release candidate.

## Release evidence

Run the live-exam benchmark against the candidate environment and preserve its machine-readable JSON report. Certify it with:

```text
npm run capacity:certify -- --input <benchmark-report.json>
```

The release environment must set `COMPETITION_CAPACITY_REPORT` to that report and `COMPETITION_ROLLBACK_SHA` to the last known-good application revision before setting `VITE_FEATURE_COMPETITION_V1=true`. Release readiness rejects an enabled rollout when either artifact is absent or the report fails certification.

## Rollout

1. Apply migrations through `0077_competition_async_xlsx_export.sql` and verify the migration registry.
2. Run the Competition release-contract tests and the stubbed Competition E2E journey.
3. Confirm structured `[Competition] mutation_completed` and `mutation_failed` events contain request, campaign/event, status, and duration context only. They must not contain questions, answers, credentials, or request bodies.
4. Enable the flag in a staged environment, then promote the same certified build and configuration.

## Rollback

Set `VITE_FEATURE_COMPETITION_V1=false` first and redeploy `COMPETITION_ROLLBACK_SHA`. This removes the user-facing entry points without destroying Competition data.

Database rollback is a separate, explicitly approved operation. Rehearsed rollback scripts live under `workers/migrations/rollback` and must run in reverse order from 0077 to 0069. Do not run destructive schema rollback as part of an automatic application rollback.
