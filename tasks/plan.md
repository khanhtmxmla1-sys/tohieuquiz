# Current Plan — Repository Hygiene After Question Presentation Release

**Previous phase:** Question Presentation Integrity & Historical Review Rendering — COMPLETED, MERGED, RELEASED via PR #92.
**Active plan:** `docs/superpowers/plans/2026-08-09-main-repository-cleanup.md`
**Status:** IN EXECUTION
**Scope:** repository/documentation/worktree hygiene only; no application code, D1 mutation, Worker deploy or Vercel deploy.

## Goal

1. Preserve all uncommitted work in a local rescue packet before cleanup.
2. Reconcile release/architecture/task documentation with the completed 2026-08-09 Question Presentation rollout.
3. Ignore only known local/generated artifacts (`/downloads/`, `/reports/bundle-report.json`) without deleting them.
4. Merge hygiene through protected `main` using a focused documentation PR.
5. After the PR is merged, fast-forward local `main`, remove only revalidated merged+clean worktrees, and delete only merged local branches using non-force deletion.
6. Keep dirty quarantine worktrees and every unmerged branch/worktree intact.

## Execution order

- Task 1: Freeze + rescue evidence.
- Task 2: Create isolated hygiene worktree from current `origin/main`.
- Task 3: Add exact ignore rules.
- Task 4: Reconcile retained documentation from rescue packet.
- Task 5: Refresh GitHub/Cloudflare/D1 deployment baseline read-only.
- Task 6: Normalize release/ADR/roadmap/progress/task documentation.
- Checkpoint A: diff review + lint/typecheck/Worker typecheck + secret/whitelist review.
- Task 7: commit, push and PR through branch protection.
- Checkpoint B: confirm merged PR is present in refreshed `origin/main`.
- Task 8: restore known root-only edits and fast-forward local `main`.
- Task 9: remove only approved merged+clean worktrees after fresh guards.
- Task 10: delete only merged local branches with `git branch -d`.
- Task 11: final cleanliness/sync/recovery verification.

## Approval boundaries

The approved cleanup plan authorizes the exact rescue, documentation, ignore, merged-clean worktree removal and non-force local-branch cleanup described in the detailed plan. It does not authorize force delete/reset/clean, dirty-worktree discard, unmerged branch removal, remote branch deletion, production deploy/migration/data mutation, or application-code changes.
