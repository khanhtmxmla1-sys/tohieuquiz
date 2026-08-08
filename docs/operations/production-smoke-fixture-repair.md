# Production smoke fixture repair runbook

## Purpose

This operation repairs only the reserved production smoke fixtures used by the automated student and parent read-only smoke checks:

- student `smoke.student` (`s-ca79f38f`);
- class `Lớp Smoke Production` (`c-production-smoke`);
- owner `smoke.teacher`.

The repair only clears `archived_at` on the exact reserved class and student. It does not change passwords, password hashes, parent access codes, PINs, parent PIN hashes, quiz data, results, or real student records.

## Safety contract

The command is dry-run by default. A production write requires both exact confirmations:

```text
--confirm-remote tohieuquiz-db
--confirm-repair production-smoke-fixtures
```

It also requires the bare `--write` flag. Before any write, the script fails closed unless all of these are true:

- the student ID, username and class ID match the reserved fixture;
- the class ID, name and teacher owner match the reserved fixture;
- `smoke.teacher` exists, has the teacher role and is active;
- at least one active parent link with a PIN exists for the smoke student.

Every successful repair writes a `PRODUCTION_SMOKE_FIXTURES_REPAIRED` entry to `admin_audit_logs` and verifies the class/student are active after the write.

## Required sequence

1. Capture a D1 Time Travel bookmark and keep it outside Git/chat.
2. Run the repair command without `--write` and confirm it reports only the reserved class/student as archived.
3. Run the production write with both exact confirmations.
4. Re-run the same command without `--write`; it must report `healthy`.
5. Run the GitHub production smoke workflow and require all role checks to pass.

## Commands

Dry-run:

```text
npm run d1:repair:smoke-fixtures -- --remote --confirm-remote tohieuquiz-db --report <private-report-path>
```

Production write:

```text
npm run d1:repair:smoke-fixtures -- --remote --confirm-remote tohieuquiz-db --write --confirm-repair production-smoke-fixtures --report <private-report-path>
```

## Rollback

Use the D1 Time Travel bookmark captured immediately before the write. The repair is intentionally limited to two `archived_at` fields plus one audit record, so rollback scope is small and explicit.
