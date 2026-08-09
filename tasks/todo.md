# Execution Checklist — Repository Hygiene After Question Presentation Release

## Previous production phase — completed
- [x] Manual Quiz Rich Text Editor + Compact Attachment released on 2026-08-08.
- [x] D1 migration `0064_add_question_rich_text.sql` applied.
- [x] Question Presentation Integrity & Historical Review Rendering implemented and merged via PR #92.
- [x] Worker rollout completed to 100% on version `0b91dd72-ff0e-40c1-8a1f-57f138bc5eca`.
- [x] Production smoke run `31295886040` completed successfully.
- [x] Remote D1 migration audit on 2026-08-09 reported no pending migrations.

## Active repository hygiene
- [x] Task 1: Create rescue packet for root dirty state and two dirty merged worktrees.
- [x] Task 2: Create isolated `chore/main-hygiene-20260809` worktree from `origin/main`.
- [x] Task 3: Add exact ignore rules for `/downloads/` and `/reports/bundle-report.json` without deleting either artifact.
- [x] Task 4: Copy retained ADR/release/roadmap/spec/plan documents from rescue into hygiene worktree.
- [x] Task 5: Refresh GitHub + Cloudflare + D1 deployment evidence read-only.
- [x] Task 6: Normalize documentation and create 2026-08-09 release evidence.
- [x] Checkpoint A: review exact diff; run lint, typecheck, Worker typecheck, `git diff --check`, secret scan and worktree/branch whitelist review.
- [ ] Task 7: commit ignore and documentation changes separately; push branch; open PR; require green checks/review.
- [ ] Checkpoint B: verify merged hygiene PR and retained docs in refreshed `origin/main`.
- [ ] Task 8: clean known root collisions and fast-forward local `main` with `--ff-only`.
- [ ] Task 9: remove only fresh-validated merged+clean worktrees from approved whitelist.
- [ ] Task 10: delete only merged local branches with `git branch -d`; keep all unmerged/dirty branches.
- [ ] Task 11: final root sync/cleanliness/recovery verification.

## Quarantine — intentionally retained
- [ ] `.worktrees/stability-audit-e2e` dirty changes require a separate review/recovery decision.
- [ ] `.worktrees/teacher-dashboard-mockup-parity` untracked plan requires a separate review/recovery decision.

## Deferred product work — not active in this cleanup
- [ ] Phase 2 rich explanation/options/items requires a new focused plan and explicit approval.
- [ ] JSON/System Prompt presentation evolution requires runtime field support and a new plan.
- [ ] Full Question Contract v2 remains conditional and requires a new ADR/spec decision gate.
