# D1 Remote Restore Rehearsal - 2026-07-29

## Scope and safety boundary

- A dedicated APAC D1 database named `tohieuquiz-db-restore-rehearsal-20260729` was used.
- The production database `tohieuquiz-db` was not queried for row data, exported, restored or mutated.
- The staging database contained synthetic records only: one admin, one class, one quiz and one result.
- Database UUIDs, full Time Travel bookmarks, passwords, cookies, JWT secrets, backup passphrases, row contents and encrypted archives are intentionally excluded from this public record.
- Temporary credentials, configuration, encrypted archives and local restore state were kept outside the repository and removed after the evidence below was captured.

## Rehearsal results

| Check | Result |
|---|---:|
| Canonical schema import | 88 non-SQLite tables available |
| Regular tables included in encrypted export | 81 |
| FTS virtual/shadow and system tables | Excluded from data export |
| Time Travel marker before restore | Present |
| Time Travel marker after restore | Removed |
| Synthetic admin/class/quiz/result after Time Travel | 1 / 1 / 1 / 1 |
| Observed Time Travel restore duration | 14.68 seconds |
| Encrypted remote backup duration | 47.833 seconds |
| Isolated local restore duration | 18.627 seconds |
| Controlled rehearsal RPO | 0 seconds |
| Missing regular tables | 0 |
| Row-count mismatches | 0 |
| Portable schema fingerprint | Match |
| Auth-column contract | Pass |
| FTS source/index parity | Pass |

## Authenticated HTTP smoke

A temporary Worker preview was bound only to the rehearsal database. The following read-only requests used a synthetic admin session:

| Request | HTTP status | Synthetic rows observed |
|---|---:|---:|
| Teacher login | 200 | N/A |
| Quiz listing | 200 | 1 |
| Class listing | 200 | 1 |
| Results listing | 200 | 1 |

No production hostname, production database binding or production account was used for these requests.

## Finding and correction

The first remote-to-local verification found that D1 preserves inline SQL comments in `sqlite_master`, while the local SQLite import omits those comments. Object counts, row counts, indexes and triggers matched, but the old fingerprint treated comments as schema and returned a false mismatch.

`schemaFingerprint()` now removes line and block comments while preserving comment-like text inside quoted SQL literals and identifiers. After the correction, the remote and local fingerprints matched and the fresh end-to-end restore report returned `ok: true` and `schemaOk: true`.

## Operational follow-up

- Keep the dedicated staging database for quarterly restore rehearsals; never repoint it to production data without a separately approved operation.
- Verify one encrypted backup each month.
- Repeat a Time Travel and authenticated staging rehearsal each quarter.
- Keep private bookmarks and encrypted artifacts in an approved vault with limited retention and access.
