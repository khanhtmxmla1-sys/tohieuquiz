# Certificate batch stall checklist

- [x] User approved implementation plan.
- [x] Create isolated worktree and feature branch.
- [x] Refresh GitNexus index and run pre-change impact analysis.
- [x] Run focused baseline tests: 26/26 passing.
- [x] RED: active lease, concurrent stale claims, all-sent crash window and incomplete notification fanout.
- [x] RED: processor permits only one simultaneous render.
- [x] GREEN: atomic lease claim, fenced writes, sequential render and full-batch finalization.
- [x] Add explicit certificate-consumer deployment command (TDD N/A: package script only).
- [x] Run focused and relevant regression verification: certificate suite 70/70; shared SQLite adapter consumers 197/197.
- [x] Run typecheck, lint, build, security checks, diff review, and `detect_changes`: passed; GitNexus LOW; final review has no P1/P2 blockers; consumer deployment dry-run passed (no production deployment).
- [ ] Obtain commit approval.
- [ ] Commit, push, PR, CI/review, merge.
- [ ] Obtain separate production mutation approval.
- [ ] Deploy and verify certificate consumer version.
- [ ] Snapshot and replay only the affected production batch.
- [ ] Verify terminal status, 21 expected certificates, and no duplicates.
- [ ] Cleanup worktree and branches.
