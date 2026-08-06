# Manual quiz editor release candidate

**Candidate date:** 2026-08-07  
**Pull request:** #76  
**Feature commit:** `e9954320b7eaad5a5f5848bcbd779955fc597601`

## Scope

- Restore an independently scrollable question navigator in the manual quiz editor.
- Connect **Quiz settings** to an accessible whole-quiz duration drawer with presets and custom minute input.
- Preserve `timeLimit` through local drafts, remote autosave, reload and publish payloads.
- Show the configured duration in the editor status area and route missing-duration validation back to the settings drawer.
- Frontend only: no Worker API contract change and no D1 migration.

## Verification evidence

- Focused Vitest coverage passed: 83 tests.
- Manual quiz Cypress coverage passed: 8 scenarios.
- Full verification passed locally: lint, frontend and Worker type checks, 2,301 tests, coverage and production build.
- Release-readiness checks passed locally with production feature flags supplied transiently.

## Release gate

- [ ] PR #76 is approved by the required reviewer.
- [ ] Current-commit CI and security checks complete successfully.
- [ ] Vercel Preview succeeds for the current commit.
- [ ] Merge only after all required checks are green.
- [ ] Vercel production deployment succeeds after merge.
- [ ] Production smoke confirms navigator scrolling, duration settings, draft persistence and publish behavior.

## Rollback

- Revert the PR merge commit if the production smoke fails.
- No database rollback is required because this candidate contains no schema or data migration.
