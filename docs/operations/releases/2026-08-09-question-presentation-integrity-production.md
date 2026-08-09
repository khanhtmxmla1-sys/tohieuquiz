# Question Presentation Integrity — Production Release

**Release date:** 2026-08-09
**PR:** #92
**Merge commit:** `406973f6794d1111d6cd84360b3d9e3c5c21c730`
**Feature commit:** `87b8427d6426e6eb524301be4e7c4d9c367e8cd4`

## Scope

- Rich → plain authoritative server projection while preserving legacy/plain compatibility.
- Cross-node math rendering so formatting marks do not split one logical formula.
- Safe rich result snapshots with a 1.5 MB final `results.answers` budget and deterministic plain fallback.
- Historical snapshot presentation precedence.
- Teacher/student historical rich review parity using the shared renderer.
- Dependency guards preventing destructive quiz deletion when submissions, active live exams, or open assignments still depend on the quiz.
- Metadata-only drift/budget observability without question text, TeX source, answer content or serialized rich JSON.

## D1

- PR #92 introduced **no new migration**.
- Existing migration `0064_add_question_rich_text.sql` provides `questions.question_rich_text`.
- Fresh remote audit on 2026-08-09 returned `No migrations to apply!`.

## Worker rollout

Candidate/production version:

```text
0b91dd72-ff0e-40c1-8a1f-57f138bc5eca
```

Previous reviewed rollback version retained:

```text
5d137d5f-9e60-4b98-a003-7bbbd1057d17
```

Deployment ID after 100% promotion:

```text
79cbc693-b59c-48b1-b444-5438ddce58fc
```

Staged rollout:

```text
0% -> 10% -> 50% -> 100%
```

Observed checks during rollout:

- Candidate 0% version-override smoke: health 200, public quiz read 200, unauthenticated guard 401, hostile unsafe-origin mutation 403, official-origin preflight 204.
- 10% observation: 60/60 health probes returned 200; 15/15 public quiz reads returned 200.
- 50% observation: 60/60 health probes returned 200; 15/15 public quiz reads returned 200.
- Immediate post-100% observation: 20/20 health probes returned 200; 5/5 public quiz reads returned 200.

## Production smoke

GitHub workflow run:

```text
31295886040
```

Conclusion:

```text
success
```

The smoke workflow used read-only production checks; rollout job was skipped by design for the `smoke` action.

## Current state at documentation time

Read-only audit on 2026-08-09 confirmed:

- Cloudflare account: `khanhtm.xmla1@gmail.com`.
- `tohieuquiz-api` deployment `79cbc693-b59c-48b1-b444-5438ddce58fc` serves version `0b91dd72-ff0e-40c1-8a1f-57f138bc5eca` at 100% traffic.
- Deployment annotation identifies the release basis as `main 406973f`.
- Repository `origin/main` has since advanced to `f17cf402f236ac14f8bb0dd4cfa568c8af8504d0`; this later repository SHA is **not** claimed to be the currently deployed Worker source.
- D1 migration registry has no pending migration.

## Verification before release

The reviewed PR evidence included focused/full Vitest, Cypress historical review coverage, lint, frontend/strict/Worker typecheck, production build, coverage, security/dependency audit, performance budget, release readiness and GitNexus/diff review. Required GitHub checks on the merge commit completed successfully before the production rollout.

## Rollback

Normal application rollback should use the previous reviewed Worker version rather than rebuilding old source blindly. Do **not** drop `question_rich_text` during a normal application rollback. Destructive schema rollback requires a separate data-retention decision and explicit production approval.
