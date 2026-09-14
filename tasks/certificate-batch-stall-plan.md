# Implementation Plan: Certificate batch stall recovery

## Overview

Prevent certificate generation batches from remaining in `processing` after a fatal consumer interruption, reduce Resvg memory pressure, make the certificate consumer deployment explicit, and safely replay the one affected production batch after the reviewed release is deployed.

## Architecture decisions

- Render certificates sequentially inside one consumer invocation to keep Resvg/WASM and font-buffer memory bounded.
- Respect the active batch lease even on redelivery; delay until its expiry instead of consuming retries every minute. Atomically claim expired work before reclaiming unfinished rows; leave sent rows untouched.
- Keep production recovery separate from code delivery. Snapshot and replay only batch `batch-549ed70b-478d-49c0-9a02-cb8a0f6ad39a` after the new consumer version is live.
- Add an explicit package command for deploying the certificate consumer so API-only deployment cannot be mistaken for a complete certificate rollout.

## Task list

### Phase 1: Regression coverage

- Add a queue redelivery test proving an interrupted `3/21` batch resumes unfinished certificates without duplicating sent ones.
- Add a processor test proving rendering is bounded to one active render at a time.
- Run focused tests and capture the expected RED failures.

### Phase 2: Minimal implementation

- Atomically reclaim expired unfinished work, preserving active owners and already sent rows.
- Reconcile full-batch status/counts and notifications, including rows completed before an interruption and the all-sent crash window.
- Reduce certificate render concurrency to one.
- Add `deploy:certificate-consumer` to the Worker package scripts.
- Run focused tests to GREEN and refactor only if needed.

### Phase 3: Review and delivery

- Run certificate regression tests, Worker/frontend typecheck, lint, build, security checks, final diff review, and GitNexus `detect_changes`.
- Obtain approval, commit only task files, push, open PR, wait for CI and reviewer approval, then merge.
- Deploy the API only if its code/config changed; deploy the certificate consumer separately and verify its live version.

### Phase 4: Production recovery

- Read-only snapshot the affected batch and its 21 certificate rows.
- With separate production mutation approval, replay the exact batch message and let the fixed expired-lease handler reclaim unfinished rows. Manual database reset is not the default and requires separate approval if needed.
- Monitor until the batch reaches a terminal state and verify all expected R2 keys/statuses without duplicating the 3 completed certificates.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Duplicate certificates | High | Never reset `sent` rows; regression-test redelivery. |
| Another runtime termination | High | Sequential Resvg rendering and monitored replay. |
| Wrong production batch mutation | High | Hard-scope by audited batch ID, snapshot before write, separate approval. |
| Consumer not updated | High | Explicit deployment command and live version verification. |

## Rollback

- Code: roll back the reviewed Worker version to its previous deployment.
- Data: preserve the pre-replay snapshot; only unfinished rows are transitioned, and the 3 sent rows remain immutable.

## Final review / commit scope

Exactly these nine files are proposed for commit:

- `workers/src/queues/certificateQueue.ts`
- `workers/src/services/certificateBatchProcessor.ts`
- `workers/package.json`
- `tests/certificateQueue.worker.test.ts`
- `tests/certificateBatchProcessor.worker.test.ts`
- `tests/helpers/sqliteD1.ts`
- `tasks/certificate-batch-stall-plan.md`
- `tasks/certificate-batch-stall-todo.md`
- `tasks/certificate-batch-stall-recovery.md`

Generated `reports/certificate-consumer-build/` artifacts are excluded.

Verification: certificate tests 70/70; shared SQLite adapter consumer tests 197/197; Worker and frontend typechecks, lint, frontend build, security checks, and consumer deployment dry-run passed. Final review found no P1/P2 blockers. GitNexus detect_changes reported LOW risk across six tracked code/test/config files; task documents are new untracked files. No production writes were performed.

Remaining risk: abandoned lease-specific R2 objects can remain after interrupted rendering; later cleanup is separate. The original runtime interruption's exact cause (including suspected memory pressure) is not proven. Production recovery remains pending approval, release and smoke verification.
