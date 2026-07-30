# Safe D1 migration wrapper — TDD evidence

## Source and intent

This work follows the production release follow-up recorded in `docs/operations/releases/2026-07-30-main-13d9ac0.md`. The goal is a dry-run-first, fail-closed path for applying D1 migration files one at a time without printing SQL or production identifiers.

## Guarantees

| Guarantee | Evidence | Result |
|---|---|---|
| Valued boolean switches cannot accidentally enable remote or write mode | `tests/d1SafeMigrations.test.ts` | PASS |
| Registry names must be a contiguous canonical prefix in canonical order | `tests/d1SafeMigrations.test.ts` | PASS |
| `--through` cannot move behind an already-applied migration | `tests/d1SafeMigrations.test.ts` | PASS |
| Every applied file is followed by full registry verification | `tests/d1SafeMigrations.test.ts` | PASS |
| Temporary SQL payloads are removed and reports do not include SQL contents | `tests/d1SafeMigrations.test.ts` | PASS |
| Local isolated dry-run → apply → up-to-date flow works with Wrangler file ingest | disposable migration fixture under `%TEMP%` | PASS |

## RED evidence

Command:

```text
npm run test:run -- tests/d1SafeMigrations.test.ts
```

Result before the implementation fix: 9 tests executed, 3 failed for valued boolean flags, registry ordering/through bounds, and post-apply registry continuity.

Checkpoint commit: `8d967a4 test(d1): add fail-closed migration safety cases`.

## GREEN evidence

Command:

```text
npm run test:run -- tests/d1SafeMigrations.test.ts
```

Result: 1 test file passed; 9/9 tests passed.

A disposable local D1 rehearsal outside the repository returned these states in order:

```text
dry-run: pending 2
applied: appliedNow 2
up-to-date: pending 0
```

The temporary migration directory and local D1 persistence directory were deleted after the run. No remote D1 command was used.

## Final verification

The final branch verification completed with:

- D1 regression group: 5 files, 33/33 tests passed.
- ESLint: passed with zero warnings.
- Frontend, strict and Workers typechecks: passed.
- Production build: 4,507 modules transformed.
- Performance budget: `ready`; initial JavaScript gzip 190,429 bytes, CSS gzip 41,300 bytes, largest lazy gzip 125,538 bytes and largest minified chunk 414,071 bytes.
- Security scan, reachable-history secret scan, policy gates and production dependency audits for root and Workers: passed with zero vulnerabilities.
- `git diff --check`: passed. Staged heuristic review found no P1/P2; one accepted P3 noted that the new standalone operations script is larger than 100 lines.

## Known boundary

`workers/schema.sql` is the latest canonical schema. It is not a historical pre-migration snapshot, so applying every migration after loading that schema correctly produces duplicate-object errors. Full historical replay requires a matching legacy snapshot; wrapper behavior is covered by unit tests and the disposable local D1 file-ingest rehearsal.
