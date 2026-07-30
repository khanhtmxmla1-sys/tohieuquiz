import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  applyPendingMigrations,
  buildMigrationPayload,
  createMigrationPlan,
  listMigrationFiles,
  normalizeOptions,
} = require('../workers/scripts/apply-d1-migrations-safe.cjs');

const tempDirs: string[] = [];

function makeTempDir(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'tohieuquiz-safe-migration-test-'));
  tempDirs.push(directory);
  return directory;
}

function writeMigration(directory: string, name: string, sql = 'CREATE TABLE demo(id TEXT);'): void {
  writeFileSync(path.join(directory, name), `${sql}\n`, 'utf8');
}

function wranglerRows(rows: Array<Record<string, unknown>>): string {
  return JSON.stringify([{ results: rows, success: true }]);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('safe D1 migration planning', () => {
  it('sorts canonical filenames and rejects unsafe or duplicate prefixes', () => {
    const directory = makeTempDir();
    writeMigration(directory, '0003_third.sql');
    writeMigration(directory, '0002_second.sql');

    expect(listMigrationFiles(directory).map((entry: { name: string }) => entry.name)).toEqual([
      '0002_second.sql',
      '0003_third.sql',
    ]);

    writeMigration(directory, 'manual-fix.sql');
    expect(() => listMigrationFiles(directory)).toThrow(/unsafe migration filename/i);
    rmSync(path.join(directory, 'manual-fix.sql'));
    writeMigration(directory, '0003_duplicate.sql');
    expect(() => listMigrationFiles(directory)).toThrow(/duplicate migration prefix/i);
  });

  it('fails closed on registry gaps, ordering drift and unknown migration names', () => {
    const files = [
      { name: '0002_second.sql' },
      { name: '0003_third.sql' },
      { name: '0004_fourth.sql' },
    ];

    expect(() => createMigrationPlan(files, ['0003_third.sql'])).toThrow(/contiguous prefix/i);
    expect(() => createMigrationPlan(files, [
      '0003_third.sql',
      '0002_second.sql',
    ])).toThrow(/registry order/i);
    expect(() => createMigrationPlan(files, ['0001_missing.sql'])).toThrow(/missing from disk/i);
    expect(() => createMigrationPlan(
      files,
      ['0002_second.sql', '0003_third.sql'],
      '0002_second.sql',
    )).toThrow(/already advanced beyond/i);
  });

  it('requires an explicit target and exact remote confirmation', () => {
    expect(() => normalizeOptions({ database: 'demo' })).toThrow(/exactly one/i);
    expect(() => normalizeOptions({ remote: true, database: 'demo' })).toThrow(
      /confirm-remote demo/i,
    );
    expect(() => normalizeOptions({ local: true, database: 'demo' })).toThrow(/persist-to/i);
    expect(normalizeOptions({
      remote: true,
      database: 'demo',
      confirmRemote: 'demo',
    }).mode).toBe('remote');
  });

  it('rejects valued boolean flags instead of coercing strings to true', () => {
    expect(() => normalizeOptions({
      remote: 'false',
      database: 'demo',
      confirmRemote: 'demo',
    })).toThrow(/--remote must be a bare flag/i);
    expect(() => normalizeOptions({
      remote: true,
      write: 'false',
      database: 'demo',
      confirmRemote: 'demo',
    })).toThrow(/--write must be a bare flag/i);
    expect(() => normalizeOptions({
      local: true,
      database: 'demo',
      persistTo: true,
    })).toThrow(/--persist-to requires a value/i);
  });
});

describe('safe D1 migration payloads', () => {
  it('keeps the original SQL and records the migration in the same file', () => {
    const payload = buildMigrationPayload(
      '0049_gift_shop_governance.sql',
      "CREATE TRIGGER demo AFTER INSERT ON items BEGIN UPDATE items SET value='x'; END;\n",
    );

    expect(payload).toContain('CREATE TABLE IF NOT EXISTS d1_migrations');
    expect(payload).toContain("CREATE TRIGGER demo AFTER INSERT ON items");
    expect(payload).toContain(
      "INSERT INTO d1_migrations (name) VALUES ('0049_gift_shop_governance.sql');",
    );
    expect(() => buildMigrationPayload(
      '0055_bad.sql',
      "INSERT INTO d1_migrations(name) VALUES ('forbidden');",
    )).toThrow(/must not modify the registry/i);
  });
});

describe('safe D1 migration execution', () => {
  it('performs a read-only dry run without creating a migration payload', () => {
    const directory = makeTempDir();
    writeMigration(directory, '0002_second.sql');
    writeMigration(directory, '0003_third.sql');
    const calls: string[][] = [];

    const report = applyPendingMigrations({
      cwd: directory,
      migrationsDir: directory,
      database: 'demo',
      config: 'wrangler.toml',
      remote: true,
      confirmRemote: 'demo',
    }, {
      runWrangler(args: string[]) {
        calls.push(args);
        return wranglerRows([{ name: '0002_second.sql' }]);
      },
    });

    expect(report).toMatchObject({
      status: 'dry-run',
      write: false,
      pending: ['0003_third.sql'],
      appliedNow: [],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('--command');
    expect(calls[0]).not.toContain('--file');
  });

  it('applies pending files sequentially, verifies the registry and removes temp payloads', () => {
    const directory = makeTempDir();
    writeMigration(directory, '0002_second.sql', 'CREATE TABLE second(id TEXT);');
    writeMigration(directory, '0003_third.sql', "CREATE TABLE third(note TEXT DEFAULT 'private-value');");
    const applied = ['0002_second.sql'];
    const payloadPaths: string[] = [];
    const payloadContents: string[] = [];

    const report = applyPendingMigrations({
      cwd: directory,
      migrationsDir: directory,
      database: 'demo',
      config: 'wrangler.toml',
      remote: true,
      confirmRemote: 'demo',
      write: true,
    }, {
      runWrangler(args: string[]) {
        const fileIndex = args.indexOf('--file');
        if (fileIndex >= 0) {
          const payloadPath = args[fileIndex + 1];
          payloadPaths.push(payloadPath);
          const payload = readFileSync(payloadPath, 'utf8');
          payloadContents.push(payload);
          const name = payload.match(/INSERT INTO d1_migrations \(name\) VALUES \('([^']+)'\)/)?.[1];
          if (!name) throw new Error('Registry insert missing from payload');
          applied.push(name);
          return wranglerRows([]);
        }
        return wranglerRows(applied.map((name) => ({ name })));
      },
    });

    expect(report).toMatchObject({
      status: 'applied',
      appliedNow: ['0003_third.sql'],
      pending: ['0003_third.sql'],
    });
    expect(payloadContents[0]).toContain("CREATE TABLE third(note TEXT DEFAULT 'private-value');");
    expect(payloadPaths.every((payloadPath) => !existsSync(payloadPath))).toBe(true);
    expect(JSON.stringify(report)).not.toContain('private-value');
  });

  it('fails when post-apply registry verification is non-contiguous', () => {
    const directory = makeTempDir();
    writeMigration(directory, '0002_second.sql');
    writeMigration(directory, '0003_third.sql');
    let executeSeen = false;

    expect(() => applyPendingMigrations({
      cwd: directory,
      migrationsDir: directory,
      database: 'demo',
      config: 'wrangler.toml',
      remote: true,
      confirmRemote: 'demo',
      write: true,
    }, {
      runWrangler(args: string[]) {
        if (args.includes('--file')) {
          executeSeen = true;
          return wranglerRows([]);
        }
        if (!executeSeen) return wranglerRows([{ name: '0002_second.sql' }]);
        return wranglerRows([{ name: '0003_third.sql' }]);
      },
    })).toThrow(/contiguous prefix/i);
  });

  it('treats a missing registry table as a new database', () => {
    const directory = makeTempDir();
    writeMigration(directory, '0002_second.sql');

    const report = applyPendingMigrations({
      cwd: directory,
      migrationsDir: directory,
      database: 'demo',
      config: 'wrangler.toml',
      local: true,
      persistTo: path.join(directory, 'state'),
    }, {
      runWrangler() {
        throw new Error('Wrangler failed: no such table: d1_migrations');
      },
    });

    expect(report.status).toBe('dry-run');
    expect(report.pending).toEqual(['0002_second.sql']);
  });
});
