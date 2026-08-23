# Competition V1 rollout and rollback

Competition V1 stays disabled until its regression suite, migration rehearsal, capacity certification, and stubbed E2E journey are green for the release candidate.

## Release evidence

Run the live-exam benchmark against the candidate environment and preserve its machine-readable JSON report. Certify it with:

```text
npm run capacity:certify -- --input <benchmark-report.json>
```

Before setting `VITE_FEATURE_COMPETITION_V1=true`, the release environment must provide:

- `COMPETITION_CAPACITY_REPORT`: the certified report produced by the candidate build;
- `COMPETITION_RELEASE_SHA`: the exact candidate application revision, matching `build.sha` in the capacity report;
- `COMPETITION_ROLLBACK_SHA`: the last known-good application revision, different from the candidate;
- `COMPETITION_ROLLOUT_STAGE`: one of `internal`, `canary`, or `school-wide`.

Release readiness rejects an enabled rollout when evidence is missing, the capacity report fails certification, its build SHA does not match the candidate, or the rollback target is not distinct.

## Rollout

1. Apply migrations through `0078_competition_result_corrections.sql` and verify the migration registry.
2. Run the Competition release-contract tests and the stubbed Competition E2E journey.
3. Confirm structured `[Competition] mutation_completed` and `mutation_failed` events contain request, campaign/event, status, and duration context only. They must not contain questions, answers, credentials, or request bodies.
4. Promote the same certified build and runtime configuration through `internal → canary → school-wide`. Update only `COMPETITION_ROLLOUT_STAGE` between stages; do not swap the candidate SHA or capacity report.
5. Stop promotion when a release contract fails, capacity evidence is no longer valid, Competition mutations produce unexpected 5xx/authorization errors, or sanitized logs contain forbidden request data.

## Rollback

Set `VITE_FEATURE_COMPETITION_V1=false` first and redeploy `COMPETITION_ROLLBACK_SHA`. This removes the user-facing entry points without destroying Competition data.

Database rollback is a separate, explicitly approved operation. Rehearsed rollback scripts live under `workers/migrations/rollback` and must run in reverse order from 0078 to 0069. Migration `0078` contains the immutable result-correction ledger, so dropping it destroys audit evidence. Do not run destructive schema rollback as part of an automatic application rollback.
