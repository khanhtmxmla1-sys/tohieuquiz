# Safe D1 migration apply path

## Why this wrapper exists

During the `main-13d9ac0` production release, the repository's SQL migrations were valid when ingested as files, but `wrangler d1 migrations apply` failed on migration `0049` with `incomplete input`. The same behavior reproduced on isolated remote D1 databases with Wrangler 4.111.0 and 4.115.0. The failure occurred before the migration registry advanced.

`apply-d1-migrations-safe.cjs` uses the D1 file-ingest path that successfully handled the canonical SQL. It places the untouched migration SQL and its `d1_migrations` registry insert in the same temporary file, applies one migration at a time, verifies the registry immediately, and deletes the temporary file.

## Safety properties

- Exactly one target mode is required: `--local` or `--remote`.
- Remote access always requires `--confirm-remote <database>`.
- The default is read-only dry-run; `--write` is required for mutation.
- Boolean switches must be bare flags. Values such as `--write false` or `--remote false` are rejected instead of being coerced to enabled.
- Migration filenames must match `NNNN_lowercase_name.sql`, and numeric prefixes must be unique.
- The applied registry must be a contiguous, canonically ordered prefix of files on disk.
- `--through` may limit forward progress but cannot target a migration behind the current registry.
- SQL payloads are written only under the operating-system temporary directory with restricted permissions and are deleted after each migration.
- Reports contain migration names and status only; SQL contents, row contents, UUIDs, bookmarks and credentials are not printed.
- After each file, the full registry is reread and must have the exact expected length, canonical order and newest migration before the next file starts.

## Remote production sequence

Run from `workers/` only after owner approval and after capturing an encrypted backup plus a Time Travel bookmark.

```powershell
# Read-only plan
node scripts/apply-d1-migrations-safe.cjs `
  --remote `
  --database tohieuquiz-db `
  --config wrangler.toml `
  --confirm-remote tohieuquiz-db

# Apply only after reviewing the pending list
node scripts/apply-d1-migrations-safe.cjs `
  --remote `
  --database tohieuquiz-db `
  --config wrangler.toml `
  --confirm-remote tohieuquiz-db `
  --write
```

Use `--through 0054_feature_rollout_control_plane.sql` to stop at a specific migration. After apply, run the migration audit, compare baseline row counts and verify that `wrangler d1 migrations list ... --remote` reports no pending migration.

## Local isolated sequence

```powershell
$state = Join-Path $env:TEMP ("tohieuquiz-d1-safe-" + [guid]::NewGuid().ToString("N"))

node scripts/apply-d1-migrations-safe.cjs `
  --local `
  --database tohieuquiz-db `
  --config wrangler.toml `
  --persist-to $state

node scripts/apply-d1-migrations-safe.cjs `
  --local `
  --database tohieuquiz-db `
  --config wrangler.toml `
  --persist-to $state `
  --write
```

Delete the isolated state after verification. A canonical `schema.sql` represents the latest schema and must not be followed by replaying the full historical migration set. For wrapper rehearsal, use a dedicated legacy snapshot or a small disposable migration fixture outside the repository.

Production rollback still uses the saved Worker version and the private Time Travel bookmark; this wrapper does not automate destructive restore operations.
