import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'tohieuquiz-d1-backup-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('D1 backup table classification', () => {
  it('excludes Cloudflare, SQLite, FTS virtual and FTS shadow tables', () => {
    const { classifyTableEntries } = require('../workers/scripts/list-backup-tables.cjs');
    const entries = [
      { name: '_cf_METADATA', type: 'table', sql: 'CREATE TABLE _cf_METADATA (key INTEGER)' },
      { name: 'sqlite_sequence', type: 'table', sql: 'CREATE TABLE sqlite_sequence(name,seq)' },
      { name: 'teachers', type: 'table', sql: 'CREATE TABLE teachers (username TEXT)' },
      { name: 'rag_chunks', type: 'table', sql: 'CREATE TABLE rag_chunks (id TEXT)' },
      { name: 'rag_chunks_fts', type: 'table', sql: 'CREATE VIRTUAL TABLE rag_chunks_fts USING fts5(content)' },
      { name: 'rag_chunks_fts_config', type: 'table', sql: 'CREATE TABLE rag_chunks_fts_config(k PRIMARY KEY, v)' },
      { name: 'rag_chunks_fts_content', type: 'table', sql: 'CREATE TABLE rag_chunks_fts_content(id INTEGER)' },
      { name: 'rag_chunks_fts_data', type: 'table', sql: 'CREATE TABLE rag_chunks_fts_data(id INTEGER)' },
      { name: 'rag_chunks_fts_docsize', type: 'table', sql: 'CREATE TABLE rag_chunks_fts_docsize(id INTEGER)' },
      { name: 'rag_chunks_fts_idx', type: 'table', sql: 'CREATE TABLE rag_chunks_fts_idx(segid, term)' },
    ];

    expect(classifyTableEntries(entries)).toEqual({
      exportTables: ['rag_chunks', 'teachers'],
      virtualTables: ['rag_chunks_fts'],
      shadowTables: [
        'rag_chunks_fts_config',
        'rag_chunks_fts_content',
        'rag_chunks_fts_data',
        'rag_chunks_fts_docsize',
        'rag_chunks_fts_idx',
      ],
      systemTables: ['_cf_METADATA', 'sqlite_sequence'],
    });
  });

  it('ignores equivalent migration-registry DDL while preserving registry data export', () => {
    const { classifyTableEntries, schemaFingerprint } = require('../workers/scripts/list-backup-tables.cjs');
    const appTable = { name: 'quizzes', type: 'table', tbl_name: 'quizzes', sql: 'CREATE TABLE quizzes(id TEXT)' };
    const remoteRegistry = {
      name: 'd1_migrations',
      type: 'table',
      tbl_name: 'd1_migrations',
      sql: 'CREATE TABLE "d1_migrations"(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)',
    };
    const localRegistry = {
      ...remoteRegistry,
      sql: 'CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)',
    };

    expect(classifyTableEntries([appTable, remoteRegistry]).exportTables).toContain('d1_migrations');
    expect(schemaFingerprint([appTable, remoteRegistry])).toBe(schemaFingerprint([appTable, localRegistry]));
  });
  it('treats additive column order as equivalent but still detects contract changes', () => {
    const { schemaFingerprint } = require('../workers/scripts/list-backup-tables.cjs');
    const migrated = [{
      name: 'students',
      type: 'table',
      tbl_name: 'students',
      sql: 'CREATE TABLE students (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, token_version INTEGER NOT NULL DEFAULT 1)',
    }];
    const canonical = [{
      ...migrated[0],
      sql: 'CREATE TABLE students (id TEXT PRIMARY KEY, token_version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)',
    }];
    const changed = [{
      ...migrated[0],
      sql: 'CREATE TABLE students (id TEXT PRIMARY KEY, token_version TEXT NOT NULL DEFAULT 1, created_at TEXT NOT NULL)',
    }];

    expect(schemaFingerprint(migrated)).toBe(schemaFingerprint(canonical));
    expect(schemaFingerprint(migrated)).not.toBe(schemaFingerprint(changed));
  });
  it('normalizes equivalent quoted table names and CHECK-list spacing', () => {
    const { schemaFingerprint } = require('../workers/scripts/list-backup-tables.cjs');
    const remote = [{
      name: 'intervention_audit',
      type: 'table',
      tbl_name: 'intervention_audit',
      sql: `CREATE TABLE "intervention_audit" (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL CHECK (action IN ( 'GROUP_CREATED', 'GROUP_ARCHIVED' ))
      )`,
    }];
    const local = [{
      ...remote[0],
      sql: `CREATE TABLE intervention_audit (
        action TEXT NOT NULL CHECK (action IN ('GROUP_CREATED', 'GROUP_ARCHIVED')),
        id TEXT PRIMARY KEY
      )`,
    }];
    const changed = [{
      ...remote[0],
      sql: `CREATE TABLE intervention_audit (
        action TEXT NOT NULL CHECK (action IN ('GROUP_CREATED', 'GROUP_DELETED')),
        id TEXT PRIMARY KEY
      )`,
    }];

    expect(schemaFingerprint(remote)).toBe(schemaFingerprint(local));
    expect(schemaFingerprint(remote)).not.toBe(schemaFingerprint(changed));
  });

  it('fingerprints indexes and triggers as part of the restorable schema', () => {
    const { classifyTableEntries, schemaFingerprint } = require('../workers/scripts/list-backup-tables.cjs');
    const base = [
      { name: 'teachers', type: 'table', tbl_name: 'teachers', sql: 'CREATE TABLE teachers(id TEXT)' },
      { name: 'idx_teachers_id', type: 'index', tbl_name: 'teachers', sql: 'CREATE INDEX idx_teachers_id ON teachers(id)' },
    ];
    const changed = [
      base[0],
      { ...base[1], sql: 'CREATE UNIQUE INDEX idx_teachers_id ON teachers(id)' },
    ];

    expect(schemaFingerprint(base, classifyTableEntries(base))).not.toBe(
      schemaFingerprint(changed, classifyTableEntries(changed)),
    );
  });

  it('ignores SQL comments while preserving comment-like text inside string literals', () => {
    const { normalizeSchemaSql, schemaFingerprint } = require('../workers/scripts/list-backup-tables.cjs');
    const remote = [{
      name: 'demo',
      type: 'table',
      tbl_name: 'demo',
      sql: `CREATE TABLE demo (
        id TEXT PRIMARY KEY, -- remote D1 preserves this comment
        note TEXT NOT NULL DEFAULT '-- keep this literal',
        label TEXT /* comment removed by local import */ DEFAULT '/* keep this too */'
      )`,
    }];
    const local = [{
      ...remote[0],
      sql: "CREATE TABLE demo ( id TEXT PRIMARY KEY, note TEXT NOT NULL DEFAULT '-- keep this literal', label TEXT DEFAULT '/* keep this too */' )",
    }];

    const normalized = normalizeSchemaSql(remote[0].sql);
    expect(normalized).not.toContain('remote D1 preserves this comment');
    expect(normalized).not.toContain('comment removed by local import');
    expect(normalized).toContain("'-- keep this literal'");
    expect(normalized).toContain("'/* keep this too */'");
    expect(schemaFingerprint(remote)).toBe(schemaFingerprint(local));
  });

  it('builds an explicit local Wrangler query with an isolated persistence directory', () => {
    const { buildListTablesArgs } = require('../workers/scripts/list-backup-tables.cjs');
    const args = buildListTablesArgs({
      database: 'tohieuquiz-db',
      config: 'wrangler.toml',
      mode: 'local',
      persistTo: 'C:/temp/source',
    });

    expect(args).toContain('--local');
    expect(args).not.toContain('--remote');
    expect(args).toContain('--persist-to');
    expect(args).toContain('C:/temp/source');
    expect(args).toContain('--json');
  });
});

describe('D1 backup output safety and encryption', () => {
  it('rejects output paths inside the repository', () => {
    const { assertOutsideRepository } = require('../workers/scripts/export-d1-tablewise.cjs');
    const repoRoot = path.resolve('C:/quizpro/example-repo');

    expect(() => assertOutsideRepository(path.join(repoRoot, 'backup.sql'), repoRoot)).toThrow(
      /outside the repository/i,
    );
    expect(() => assertOutsideRepository(repoRoot, repoRoot)).toThrow(/outside the repository/i);
    expect(() => assertOutsideRepository('C:/safe-backups/backup.sql', repoRoot)).not.toThrow();
  });

  it('builds a confirmed remote data-only export and refuses implicit remote mode', () => {
    const { buildExportArgs } = require('../workers/scripts/export-d1-tablewise.cjs');
    const args = buildExportArgs({
      database: 'tohieuquiz-db',
      config: 'wrangler.toml',
      mode: 'remote',
      confirmRemote: 'tohieuquiz-db',
      output: 'C:/safe-backups/plain.sql',
      tables: ['classes', 'students'],
    });

    expect(args).toContain('--remote');
    expect(args).toContain('--no-schema');
    expect(args.filter((value: string) => value === '--table')).toHaveLength(2);
    expect(() => buildExportArgs({
      database: 'tohieuquiz-db',
      config: 'wrangler.toml',
      mode: 'remote',
      output: 'C:/safe-backups/plain.sql',
      tables: ['teachers'],
    })).toThrow(/confirm-remote/i);
    expect(() => buildExportArgs({
      database: 'tohieuquiz-db',
      config: 'wrangler.toml',
      mode: 'local',
      output: 'C:/safe-backups/plain.sql',
      tables: ['teachers'],
    })).toThrow(/node:sqlite/i);
  });

  it('batches remote row-count queries at the observed D1 compound-select limit', () => {
    const { chunkValues } = require('../workers/scripts/export-d1-tablewise.cjs');
    const tables = Array.from({ length: 12 }, (_, index) => `table_${index}`);

    expect(chunkValues(tables).map((batch: string[]) => batch.length)).toEqual([5, 5, 2]);
  });

  it('serializes SQL values without losing quotes or binary data', () => {
    const { serializeSqlValue } = require('../workers/scripts/export-d1-tablewise.cjs');

    expect(serializeSqlValue("O'Brien")).toBe("'O''Brien'");
    expect(serializeSqlValue(null)).toBe('NULL');
    expect(serializeSqlValue(42)).toBe('42');
    expect(serializeSqlValue(new Uint8Array([0, 15, 255]))).toBe("X'000fff'");
  });

  it('round-trips a gzip + AES-256-GCM archive and detects a wrong passphrase', async () => {
    const {
      decryptArchive,
      encryptArchive,
    } = require('../workers/scripts/export-d1-tablewise.cjs');
    const dir = makeTempDir();
    const source = path.join(dir, 'source.sql');
    const archive = path.join(dir, 'backup.sql.gz.enc');
    const restored = path.join(dir, 'restored.sql');
    const contents = 'CREATE TABLE demo(id TEXT);\nINSERT INTO demo VALUES (\'row-1\');\n';
    writeFileSync(source, contents, 'utf8');

    const encryption = await encryptArchive({
      source,
      archive,
      passphrase: 'correct horse battery staple',
    });
    expect(readFileSync(archive).subarray(0, 16).toString('utf8')).not.toContain('CREATE TABLE');

    await decryptArchive({
      archive,
      output: restored,
      passphrase: 'correct horse battery staple',
      encryption,
    });
    expect(readFileSync(restored, 'utf8')).toBe(contents);

    await expect(decryptArchive({
      archive,
      output: path.join(dir, 'wrong.sql'),
      passphrase: 'this passphrase is wrong',
      encryption,
    })).rejects.toThrow();
  });
});

describe('D1 artifact retention safety', () => {
  it('ignores encrypted archives and their private metadata by default', () => {
    const gitignore = readFileSync('.gitignore', 'utf8');
    expect(gitignore).toContain('tohieuquiz-d1-*.sql.gz.enc');
    expect(gitignore).toContain('tohieuquiz-d1-*.manifest.json');
    expect(gitignore).toContain('tohieuquiz-d1-*.restore-report.json');
  });
});

describe('D1 restore verification', () => {
  it('creates an empty migration registry before importing a production backup', () => {
    const { RESTORE_REGISTRY_SQL } = require('../workers/scripts/verify-d1-restore.cjs');

    expect(RESTORE_REGISTRY_SQL).toContain('CREATE TABLE IF NOT EXISTS d1_migrations');
    expect(RESTORE_REGISTRY_SQL).not.toMatch(/INSERT/i);
  });

  it('builds a trigger-safe snapshot reset before importing backup rows', () => {
    const {
      buildClearSnapshotTablesSql,
      buildDropTriggersSql,
      buildRestoreTriggersSql,
    } = require('../workers/scripts/verify-d1-restore.cjs');

    expect(buildDropTriggersSql([
      { name: 'trg_reward', sql: 'CREATE TRIGGER trg_reward AFTER INSERT ON gift_orders BEGIN SELECT 1; END' },
      { name: 'trg_audit', sql: 'CREATE TRIGGER trg_audit AFTER UPDATE ON teachers BEGIN SELECT 1; END' },
    ])).toBe([
      'DROP TRIGGER IF EXISTS "trg_reward";',
      'DROP TRIGGER IF EXISTS "trg_audit";',
    ].join('\n'));

    expect(buildClearSnapshotTablesSql(['feature_flags', 'student_reward_ledger'])).toBe([
      'PRAGMA foreign_keys=OFF;',
      'DELETE FROM "feature_flags";',
      'DELETE FROM "student_reward_ledger";',
      'PRAGMA foreign_keys=ON;',
    ].join('\n'));

    expect(buildRestoreTriggersSql([
      { name: 'trg_reward', sql: 'CREATE TRIGGER trg_reward AFTER INSERT ON gift_orders BEGIN SELECT 1; END' },
      { name: 'trg_audit', sql: 'CREATE TRIGGER trg_audit AFTER UPDATE ON teachers BEGIN SELECT 1; END;' },
    ])).toBe([
      'CREATE TRIGGER trg_reward AFTER INSERT ON gift_orders BEGIN SELECT 1; END;',
      'CREATE TRIGGER trg_audit AFTER UPDATE ON teachers BEGIN SELECT 1; END;',
    ].join('\n'));
  });

  it('reports missing tables and row-count mismatches without exposing row contents', () => {
    const { compareRestoreSnapshot } = require('../workers/scripts/verify-d1-restore.cjs');
    const result = compareRestoreSnapshot(
      { teachers: 2, students: 5, quizzes: 3 },
      { teachers: 2, students: 4 },
    );

    expect(result.ok).toBe(false);
    expect(result.missingTables).toEqual(['quizzes']);
    expect(result.rowCountMismatches).toEqual([
      { table: 'students', expected: 5, actual: 4 },
    ]);
    expect(JSON.stringify(result)).not.toContain('username');
  });
});
