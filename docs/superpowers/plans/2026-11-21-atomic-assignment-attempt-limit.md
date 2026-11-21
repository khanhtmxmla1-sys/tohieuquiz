# Atomic assignment result attempt limit

## Objective and authorization

User requested a detailed plan followed by implementation for the assignment submission race. Baseline: merged main `c96a1b3eb9c5be91f63b6f83b892c1e48cca3567`; production Worker C2.2 `bfcc2855-59b1-4e82-8405-ffa207ba2095`.

Worktree: `C:/Users/Administrator/.codex/worktrees/security-assignment-attempts-atomic/quizpro`; branch `codex/security-assignment-attempts-atomic`.

The user explicitly approved the plan and CRITICAL-impact confirmation in chat. GitNexus upstream impact on `handleResultRoutes` returned one direct caller, 710 impacted symbols and 46 processes. The router graph is broad; code edits remain confined to the result insertion branch. Do not treat this broad graph as proof every process changes behavior.

## Observed defect

`workers/src/routes/results.ts` checks the number of completed results by exact assignment/student, grades the answers, then performs an unconditional insert. Two requests can both observe one remaining attempt before either writes. Both can then persist a result and trigger notifications/activity.

Existing semantics exclude rows whose answers are exactly `{"status":"STARTED"}`. The canonical student ID and exact assignment have already been resolved by the Worker. The existing `idx_results_assignment_student` index supports the count predicate.

## Proposed behavior

For an assigned submission, use one SQLite write statement: `INSERT INTO results (...) SELECT ... WHERE (SELECT COUNT(*) FROM results WHERE assignment_id = ? AND student_id = ? AND COALESCE(answers, '') != '{"status":"STARTED"}') < ?`.

The count and insert are evaluated within the same write statement, using server-derived assignment/student IDs and the existing normalized attempt limit. This removes the stale read from the admission decision. Preserve the early count check as a fast rejection; the write predicate is authoritative.

Inspect `meta.changes` before reading `last_row_id` or executing side effects. If the assigned insert writes zero rows, return the existing HTTP 409 `ASSIGNMENT_ATTEMPTS_EXHAUSTED` contract with `attemptCount` and `maxAttempts`. Obtain the count for the error message; it does not authorize another write. Database failures must remain failures and must not be converted into successful submissions or misleading quota errors.

Unassigned submissions retain their current insert behavior. Scoring, authorization, response fields on success, draft preservation on 409, and the existing exact STARTED exclusion remain unchanged. A rejected competing request creates no result, notification or game activity.

Retry semantics remain the existing API semantics: each accepted request is a result. This package bounds accepted results by the limit; it does not add an idempotency key, deduplicate requests while multiple attempts remain, or replay a previous response. Such behavior requires a separate client/server contract design.

## Expected files

1. This plan.
2. `workers/src/routes/results.ts`: conditional insert and zero-write handling only.
3. `tests/resultAssignmentAttempts.worker.test.ts`: deterministic competing-submission route regression and side-effect/error assertions.
4. `tests/resultAssignmentAtomicity.worker.test.ts`: execute the actual route-generated SQL against real SQLite using `node:sqlite`, including independent connections where feasible.

No frontend source, schema, migration, dependencies, config, secrets or feature flags are planned. If implementation requires more files or a migration, report why and update the plan before expanding scope.

## Tasks and acceptance criteria

### 1. Confirm impact gate and test setup

- Present CRITICAL impact and receive explicit confirmation before executable changes.
- Use the dedicated worktree; preserve all unrelated worktrees.
- Use the clean dependency installations from the release worktree only after checking their root and Worker lockfiles match this baseline. Record any dependency links; never link to the stale original checkout.
- Run GitNexus analysis for each additional existing symbol edited; no symbol renaming is planned.

### 2. Reproduce the race before fixing it (RED)

- Force two or more requests through the early attempt check before any inserts complete.
- Start with limit 1 and zero completed results: exactly one success and one or more 409 responses must be expected; the old unconditional insert must fail this expectation.
- Start with limit 3 and two completed results: exactly one additional result may persist.
- Show RED evidence against the unchanged implementation; assertions must check persisted rows and side effects, not merely SQL substrings.

### 3. Implement the smallest atomic write (GREEN)

- Keep the early check, canonical IDs, grading and response contract intact.
- Add the atomic condition only when assignment scope exists.
- Check the write count before using the result ID.
- Return the established 409 response for the losing request; execute side effects only for the actual inserted row.
- Do not introduce a process-local lock, a separate unguarded read/write transaction across awaits, or a new reservation ledger.

### 4. Verify edge cases and database semantics

- Real SQLite executes the exact generated insert predicate, including competing writes to the same database.
- Different students and different assignments do not consume each other's limits.
- Multiple assignments reusing one quiz remain independent.
- STARTED sentinel rows do not consume completed attempts; null/ordinary answers keep existing count semantics.
- Existing exhausted assignments return 409 without inserting.
- Unassigned and staff submission compatibility is preserved.
- SQL write failure causes no success response or side effects.
- Losing requests do not reuse stale `last_row_id` and do not trigger activity/notifications.
- Existing frontend 409 draft/retry tests remain green.
- Inspect query plan to confirm the assignment/student index supports the count.

### 5. Review and verification

- Focused new/updated tests and adjacent results/assignment/scoring/security suites.
- Worker and frontend typecheck, relevant lint, Worker dry-run build and security scan.
- Review real diffs and RED/GREEN evidence; independent specification and quality/security review; resolve P1/P2 findings.
- GitNexus `detect_changes` against main before commit; investigate unexpected scope.
- Full CI/release readiness after PR creation; do not bypass required checks or human approval.

### 6. Delivery and rollout gates

- Report exact files, checks and remaining limitations for final commit approval under AGENTS step 6.
- After approval: focused commit, push, PR, CI and required GitHub review, then merge.
- Build Worker from merged SHA with clean lockfile dependencies; record JS/WASM SHA256 and compare uploaded bytes before traffic.
- Obtain separate approval for the concrete Worker artifact before production deployment under AGENTS step 11.
- No production D1 mutations or migration are needed for this design.
- Post-deploy public/authenticated read-only smoke; do not create competing production student results to test the race.

## Risks and rollback

- CRITICAL router-level graph requires an explicit confirmation gate and focused diff review.
- Requests may both perform grading before one loses the insert; this package prioritizes correct limits, not reducing duplicated grading work.
- Existing results above limits are preserved; this package does not delete or rewrite historical data.
- Concurrent teacher policy changes and exact retry replay are not redesigned here.
- Rollback uses the immutable pre-release Worker version, currently C2.2 `bfcc2855-59b1-4e82-8405-ffa207ba2095`, rechecked immediately before deployment. No database rollback is needed. Rollback restores the pre-fix race and must be reported explicitly.

## Technical references

- SQLite serializes writers and provides serializable transactions: https://www.sqlite.org/isolation.html
- Cloudflare D1 prepared statements return write metadata through `run()`: https://developers.cloudflare.com/d1/worker-api/prepared-statements/

## Current status

Plan and CRITICAL impact approved; isolated worktree created. RED confirmed on the old implementation: the competing-request regression expected `[200,409]` but received `[200,200]` and created two parent notifications. Implementation is complete. Eight focused/adjacent suites passed 61 distinct tests, including seven real SQLite tests. Frontend and Worker typecheck, targeted lint, security scan, Worker dry-run build and diff whitespace checks passed. Final review found no P1/P2 issues. No commit, push, upload or production change for this package.

Root and Worker dependency links point to the clean `security-c22-worker-release` installation, whose lockfiles match the baseline. The original checkout's stale dependency links are not used. A new GitNexus refresh was attempted but had to stop when C: filled; only this task's newly generated index database file was removed to recover space. The user freed disk space, permitting the dry-run build and a new refresh. Incremental refresh then encountered an inconsistent FTS index; a forced full index rebuild completed successfully (26,778 nodes, 54,260 edges, 300 flows). Change detection for the existing tracked code reports MEDIUM risk with two result-handler flows; final detection also includes the new test and this plan before commit approval.

SQLite evidence scope: two route requests are forced to overlap before their writes on one connection; a separate test executes the captured route-generated SQL sequentially through two independent connections to one file-backed database. These tests verify the stale-read regression and persisted limits; they do not claim an OS-level competing-lock load test or a production mutation test.
