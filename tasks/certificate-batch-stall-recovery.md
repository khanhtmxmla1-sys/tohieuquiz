# Certificate batch recovery release checklist

## Scope and evidence

Incident batch: `batch-549ed70b-478d-49c0-9a02-cb8a0f6ad39a`.
Read-only incident inspection found 21 rows: 3 sent, 18 processing, zero pending/failed. Last recorded progress was 2026-09-13T15:37:33.331Z.
Runtime termination cause and actual DLQ contents have not been confirmed from historical logs. Memory pressure is a hypothesis, not an observed exception.

## Release

1. Require reviewed merge and passing required CI.
2. Record the live certificate consumer version and rollback version before deployment. Previously observed live version: `dcf71498-724c-43e9-b487-2e72a9e61bdc` (re-check).
3. Deploy the reviewed consumer using `npm run deploy:certificate-consumer` from `workers/` only after production approval.
4. Verify the live version, D1/R2 bindings and queue consumer configuration. Frontend deployment and public HTTP smoke alone do not verify this consumer.

## Recovery

1. Obtain a fresh read-only snapshot of the exact batch and all certificate IDs/statuses/timestamps/R2 keys. Keep the snapshot outside Git, without publishing student data.
2. Confirm no active owner and inspect queue/DLQ state where read-only access permits. Never purge or replay an entire queue.
3. With approval, enqueue exactly one JSON message `{ "batchId": "batch-549ed70b-478d-49c0-9a02-cb8a0f6ad39a" }`. Prefer the fixed consumer's expired-lease recovery over manual database writes. If manual reset is required, separately review exact predicates and affected counts first.
4. Monitor batch and certificate state until terminal. Preserve the original three sent timestamps and R2 keys. Verify total count remains 21 and that newly sent certificates have image keys.
5. Verify completion counts and notifications include previously completed certificates without duplicates. A terminal failure is a blocker, not success.

## Rollback and safety

- If the consumer is unhealthy, restore the captured previous version and stop replaying messages.
- Do not reset sent certificates or remove stored images.
- Retain incident snapshots until recovery is verified. Do not use a whole-database rollback for this batch.
- Remove only the task's worktree/branches after verified completion; preserve other worktrees.
