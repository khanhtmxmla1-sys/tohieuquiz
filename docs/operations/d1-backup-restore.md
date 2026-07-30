# D1 Backup and Restore Runbook

## Safety boundary

- Production database: `tohieuquiz-db`.
- Backup and restore scripts require an explicit mode. Local runs require `--persist-to`; remote reads require `--remote --confirm-remote <database>`.
- `verify-d1-restore.cjs` is local-only and rejects `--remote`.
- Backup archives, manifests and restore state must be outside the Git repository. The scripts reject repository paths before writing.
- Never put a passphrase in CLI arguments, files, shell history, `.env`, logs or CI artifacts. Supply it through `D1_BACKUP_PASSPHRASE` or another explicitly named environment variable.
- Backup and restore rehearsal commands are read-only for production. Approved production schema changes must use the dry-run-first [safe migration wrapper](./d1-safe-migrations.md) after a fresh encrypted backup and Time Travel bookmark.

## Backup format

Node.js 22.22 or newer is required for the local streaming adapter.

The exporter:

1. queries `sqlite_master` for tables, indexes, views and triggers;
2. excludes `_cf_*`, `sqlite_*`, FTS virtual tables and every FTS shadow table;
3. records row counts and a schema fingerprint;
4. exports regular-table data only;
5. compresses with gzip;
6. encrypts with AES-256-GCM using a key derived with scrypt;
7. deletes the plaintext SQL;
8. writes an encrypted archive and manifest outside the repository.

The restore verifier creates the canonical schema first, imports regular table data, rebuilds `rag_chunks_fts`, compares every row count and schema fingerprint, and runs auth/API database-contract smoke queries.

Schema fingerprints ignore SQL comments because remote D1 can preserve comments in `sqlite_master` while a local SQLite import omits them. Quoted string and identifier content remains part of the fingerprint.

## Local isolated rehearsal

Run from `workers/`. Both persistence directories and the backup directory must be outside the repository.

```powershell
$base = Join-Path $env:TEMP ("tohieuquiz-d1-rehearsal-" + [guid]::NewGuid().ToString("N"))
$source = Join-Path $base "source"
$restore = Join-Path $base "restore"
$backup = Join-Path $base "backup"
New-Item -ItemType Directory -Force -Path $source, $backup | Out-Null

$env:D1_BACKUP_PASSPHRASE = Read-Host "Backup passphrase"

npx wrangler d1 execute tohieuquiz-db --config wrangler.toml --local --persist-to $source --file schema.sql --yes
node --no-warnings scripts/export-d1-tablewise.cjs --local --persist-to $source --output-dir $backup

$manifest = Get-ChildItem $backup -Filter *.manifest.json | Select-Object -First 1
$archive = Get-ChildItem $backup -Filter *.sql.gz.enc | Select-Object -First 1
node --no-warnings scripts/verify-d1-restore.cjs --archive $archive.FullName --manifest $manifest.FullName --persist-to $restore

Remove-Item Env:D1_BACKUP_PASSPHRASE
```

A successful report must have:

- `ok: true`;
- `schemaOk: true`;
- no missing tables or row-count mismatches;
- auth column smoke passing;
- FTS indexed row count equal to its source join count;
- observed backup and restore durations.

## Dedicated staging Time Travel rehearsal

Time Travel always acts on a remote D1 database. Do not run these commands unless a separate staging database has been created and its name is visibly different from `tohieuquiz-db`.

```powershell
$stagingDb = "tohieuquiz-db-restore-rehearsal"
if ($stagingDb -eq "tohieuquiz-db") { throw "Production database is forbidden" }

npx wrangler d1 time-travel info $stagingDb --config wrangler.toml --json
# Save the returned bookmark in the private rehearsal record.

# Apply a harmless, staging-only marker mutation, verify it exists, then restore the staging DB:
npx wrangler d1 time-travel restore $stagingDb --config wrangler.toml --bookmark <STAGING_BOOKMARK> --json
```

After restoration, repeat schema/row-count checks against staging and run authenticated HTTP smoke tests for teacher login, quiz listing, class listing and results retrieval. Record the bookmark, operator, start/end timestamps, observed RPO/RTO and evidence location. Never include tokens, password hashes, row contents or raw dumps in the record.

## Completed remote rehearsal - 2026-07-29

The dedicated APAC staging rehearsal completed successfully. Time Travel removed a staging-only marker while preserving the synthetic admin/class/quiz/result snapshot. The encrypted remote export covered 81 regular tables; the fresh local restore returned `ok: true`, `schemaOk: true`, zero missing tables and zero row-count mismatches. Authenticated teacher login plus quiz, class and results read paths all returned HTTP 200.

Redacted evidence and observed RPO/RTO are recorded in [`d1-restore-rehearsal-2026-07-29.md`](./d1-restore-rehearsal-2026-07-29.md). Full bookmarks, UUIDs, credentials and archives are deliberately not stored in Git.

## Safe production migrations

Do not invoke `wrangler d1 migrations apply` directly for this repository until its file-splitting behavior has been revalidated against the current migration set. Use [`apply-d1-migrations-safe.cjs`](./d1-safe-migrations.md), review the dry-run pending list, require exact remote confirmation, and verify the registry after every file.

## Retention and access

- Store encrypted archives in a private bucket or vault with least-privilege access and retention policy.
- Keep manifests private because table names and row counts are operational metadata.
- Rotate the backup passphrase independently from application secrets.
- Verify one backup monthly and rehearse a staging restore quarterly.
- Delete local rehearsal directories after evidence has been captured.

## Rollback

These scripts are read-only for the source database. If a restore rehearsal fails, delete the isolated target directory and rerun from a known-good encrypted archive. Production Time Travel or database replacement requires owner approval, a saved bookmark and the release rollback checklist.
