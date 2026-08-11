# Announcement Management & Feature Rollout — Production Release

**Release date:** 2026-08-11
**PR:** #106
**Merge commit:** `ead956616b2e44098ac4df0d0ffbc5b8bf78519e`
**Feature commit:** `3b54c9077a97a4c36593a1d3a78950837fec525f`

## Scope

- Reworked admin announcement management into a list-first workflow with create/edit/review steps, presets, scheduling, lifecycle actions, dirty-state protection and production-component preview.
- Restricted announcement authoring UI to supported display channels: `CRITICAL_STRIP`, `TICKER` and `BANNER`.
- Enforced publish/schedule validation again in the Worker, including non-empty content, at least one channel, urgent/critical-strip compatibility, safe CTA links and valid schedule windows.
- Preserved `SCHEDULED`, `PUBLISHED`, `EXPIRED` and `ARCHIVED` lifecycle semantics instead of coercing historical records back to draft.
- Moved Feature Rollout to the dedicated admin route `/teacher/feature-rollout`.
- Added atomic batch feature-flag updates with optimistic version checks and one audit record for the batch.
- Added explicit rollback confirmation and clearer Vietnamese presentation for rollout audiences, percentages, allowlists and monitoring thresholds.
- No D1 migration was introduced by PR #106.

## Runtime API contract

Announcement administration remains admin-only under:

```text
/api/admin/announcements
/api/admin/announcements/:id
/api/admin/announcements/:id/publish
/api/admin/announcements/:id/cancel
/api/admin/announcements/:id/archive
/api/admin/announcements/:id/end
```

The runtime feature-flag control plane is:

```text
GET   /api/system-settings/feature-flags
GET   /api/system-settings/feature-flags/resolve
PATCH /api/system-settings/feature-flags/:key
PATCH /api/system-settings/feature-flags/:key/batch
POST  /api/system-settings/feature-flags/:key/rollback
```

The admin Feature Rollout UI uses the `:key/batch` endpoint for one logical edit. The payload includes `changes`, a required audit `reason`, and `expectedVersion`. The Worker validates the complete batch before mutation, rejects version conflicts, increments the feature version once and writes one `__batch__` audit entry containing the full before/after configuration.

The legacy single-field PATCH endpoint remains available for backward compatibility. The staged-rollout CLI continues to use audited single-field patches with compensating rollback if a later field fails; it has not been silently converted to batch mode.

## Worker production rollout

Cloudflare account verified before deployment:

```text
khanhtm.xmla1@gmail.com
```

Worker:

```text
tohieuquiz-api
```

Production version deployed from the approved feature commit before frontend merge:

```text
c744f751-3ba0-40b5-ac7e-401e7c019e23
```

Previous production version retained as the reviewed rollback point:

```text
96ee5fce-2187-482c-a1f8-eb66be403a49
```

Deployment annotation:

```text
PR #106 announcement and feature-rollout backend; rollback 96ee5fce retained
```

The Worker was deployed before merging PR #106 because the backend changes are backward-compatible and the Vercel Git integration deploys `main` automatically. This ordering prevented the new frontend from depending on an older Worker contract.

## Worker pre-merge smoke

Read-only production smoke was run after the Worker deployment and before the frontend merge:

```text
GitHub run: 31502835275
Conclusion: success
```

The production-smoke workflow used `mutation_namespace=none`; no business-data production mutation was performed.

## Merge and frontend production

PR #106 was approved on the exact feature commit and merged only after all required PR checks were green.

Merge commit:

```text
ead956616b2e44098ac4df0d0ffbc5b8bf78519e
```

Vercel production deployment for the merge commit:

```text
GitHub deployment ID: 5852660659
State: success
Environment: Production
```

The Vercel deployment for `ead9566` completed successfully before the post-deploy production smoke finished.

## Production verification evidence

Main CI:

```text
GitHub run: 31502976649
Conclusion: success
```

This run passed ESLint, frontend/strict/Worker type checks, coverage, both Vitest shards and the production build/performance checks. Cypress PR gates had already passed on PR #106 and the main Release Readiness workflow reran its independent browser readiness jobs.

Security:

```text
GitHub run: 31502976662
Conclusion: success
```

Release Readiness:

```text
GitHub run: 31502976562
Conclusion: success
```

Its core gate passed full verification, performance budget, migration/rollback contract verification and report generation. The final browser readiness jobs also passed:

- Cypress AI SVG diagram readiness.
- Cypress Blueprint V3 readiness.
- Cypress stubbed readiness.
- Aggregate `Release ready` gate.

Post-Vercel production smoke:

```text
GitHub run: 31503033979
Conclusion: success
```

The automatic deployment-status smoke ran read-only checks against the production site/API after the Vercel production deployment for `ead9566`.

## Route guard probes after release

Unauthenticated read-only probes were used only to verify that the newly documented route families were registered and protected by authentication:

```text
GET /api/admin/announcements
=> 401

GET /api/system-settings/feature-flags
=> 401

GET /api/system-settings/feature-flags/resolve?flag=unified_notifications_v1
=> 401
```

These results confirm route matching plus the expected auth guard and, importantly, no 5xx response for these probes. They are not a substitute for authenticated business-data mutation testing in production.

## D1

- PR #106 introduced no migration.
- No schema mutation was required for this release.
- The source migration set currently reaches `0066_student_reward_ledger.sql`.
- A read-only remote D1 migration audit on 2026-08-11 returned `No migrations to apply!`.
- Release Readiness passed its migration/rollback contract verification.

## Rollback

Worker rollback should use the retained reviewed version:

```text
96ee5fce-2187-482c-a1f8-eb66be403a49
```

Frontend rollback should use the previous Vercel production deployment if a UI regression is isolated to the frontend. Because the new Worker contract preserves the legacy single-field feature-flag endpoint and existing announcement paths, normal frontend rollback does not require a D1 rollback.

For a bad rollout configuration rather than a bad Worker build, prefer the audited feature-flag rollback endpoint for the affected key and preserve the before/after audit trail.

## Cleanup

After merge, successful production smoke and successful Release Readiness:

- worktree `announcement-rollout-ux` was removed;
- local branch `feat/announcement-rollout-ux` was removed;
- remote branch `feat/announcement-rollout-ux` was removed.

The dirty local `main` checkout was intentionally not reset, pulled or cleaned because it contained unrelated in-progress changes.
