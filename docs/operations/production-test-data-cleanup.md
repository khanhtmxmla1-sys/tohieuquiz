# Production test-data cleanup runbook

## Scope

Task 38 removes only the approved production fixtures:

- teacher `test.gv1`;
- students `test.hs1` and `test.hs2`;
- class `Lớp Test 1`;
- product artifacts linked to that teacher, class, quiz, assignments, results, live exam, reports, certificates and notifications;
- the two generated certificate PNG objects in the private R2 bucket.

The following records are protected:

- `tongminhkhanh`, `admin`, `viethong` and `smoke.admin`;
- the dedicated production-smoke accounts;
- `thienkhanh`, because it was not included in the approved deletion list.

Before the old class is removed, `smoke.student` and `thienkhanh` are moved to the deterministic class `Lớp Smoke Production`, owned by `smoke.teacher`. Any additional class occupant makes the script fail closed.

## Safety contract

The script is dry-run by default. A production write requires both exact confirmations:

```text
--confirm-remote tohieuquiz-db
--confirm-cleanup task38-test-fixtures
```

It also requires the bare `--write` flag. Boolean-looking values such as `--write false` are rejected.

The D1 mutation is one transaction. The script then verifies that:

- the approved teacher, students and old class are absent;
- protected owners still exist;
- the two preserved students are in the production-smoke class;
- the production-smoke teacher remains active;
- a single `PRODUCTION_TEST_DATA_CLEANED` audit record exists.

Audit and security history are retained. The script does not delete `admin_audit_logs`, `security_events` or feature-flag audit history.

## Required sequence

1. Capture a current D1 Time Travel bookmark and store the full bookmark outside the repository.
2. Run the script without `--write` and review row counts.
3. Merge the reviewed script and tests to `main` with all required checks green.
4. Run the write command from the merged commit and save its report outside the repository.
5. Run the production smoke workflow for admin, teacher, student and parent.
6. Verify D1 identities, audit row, Worker health and the private R2 cleanup.
7. Update the release evidence and only then mark Task 38 complete.

## Commands

Run from the repository root.

Dry-run:

```text
npm run d1:cleanup:test-data -- --remote --confirm-remote tohieuquiz-db --report <private-report-path>
```

Production write:

```text
npm run d1:cleanup:test-data -- --remote --confirm-remote tohieuquiz-db --write --confirm-cleanup task38-test-fixtures --report <private-report-path>
```

The report path must be outside the repository. It contains identifiers and row counts but no password, token, hash, parent contact data or secret value.

## Rollback

The primary rollback is D1 Time Travel using the private pre-cleanup bookmark. Do not place the full bookmark in Git, CI logs or chat.

The two certificate image keys are deterministic and are removed only after D1 post-verification. If R2 deletion fails, D1 remains clean and the orphaned private objects can be deleted by rerunning the operation or by using `wrangler r2 object delete` with the recorded keys. The default certificate template/background is not deleted.
