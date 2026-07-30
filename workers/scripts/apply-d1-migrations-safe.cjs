#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  parseCliArgs,
  parseWranglerJson,
  runWrangler,
} = require('./list-backup-tables.cjs');

const MIGRATION_FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
const REGISTRY_TABLE_SQL = [
  'CREATE TABLE IF NOT EXISTS d1_migrations (',
  '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
  '  name TEXT UNIQUE,',
  '  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL',
  ');',
].join('\n');
const REGISTRY_QUERY = 'SELECT name FROM d1_migrations ORDER BY id';

function quoteSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function readBareFlag(input, key, cliName = key) {
  const value = input[key];
  if (value === undefined || value === false) return false;
  if (value !== true) {
    throw new Error(`--${cliName} must be a bare flag without a value.`);
  }
  return true;
}

function normalizeOptions(input = {}) {
  const database = String(input.database || 'tohieuquiz-db');
  const config = String(input.config || 'wrangler.toml');
  const cwd = path.resolve(String(input.cwd || path.resolve(__dirname, '..')));
  const migrationsDir = path.resolve(cwd, String(
    input.migrationsDir || input['migrations-dir'] || 'migrations',
  ));
  const remote = input.mode === 'remote' || readBareFlag(input, 'remote');
  const local = input.mode === 'local' || readBareFlag(input, 'local');

  if (remote === local) {
    throw new Error('Choose exactly one D1 target mode: --local or --remote.');
  }

  const mode = remote ? 'remote' : 'local';
  const confirmRemote = input.confirmRemote || input['confirm-remote'];
  const persistTo = input.persistTo || input['persist-to'];
  if (persistTo === true) {
    throw new Error('--persist-to requires a value.');
  }
  if (mode === 'remote' && confirmRemote !== database) {
    throw new Error(`Remote D1 access requires --confirm-remote ${database}`);
  }
  if (mode === 'local' && !persistTo) {
    throw new Error('Local D1 access requires --persist-to for an isolated database state.');
  }

  return {
    database,
    config,
    cwd,
    migrationsDir,
    mode,
    confirmRemote: confirmRemote ? String(confirmRemote) : undefined,
    persistTo: persistTo ? path.resolve(String(persistTo)) : undefined,
    through: input.through ? String(input.through) : undefined,
    write: readBareFlag(input, 'write'),
  };
}

function listMigrationFiles(migrationsDir, through) {
  if (!fs.existsSync(migrationsDir) || !fs.statSync(migrationsDir).isDirectory()) {
    throw new Error(`Migration directory does not exist: ${migrationsDir}`);
  }

  const sqlNames = fs.readdirSync(migrationsDir)
    .filter((name) => name.toLowerCase().endsWith('.sql'));
  const invalid = sqlNames.filter((name) => !MIGRATION_FILE_PATTERN.test(name));
  if (invalid.length > 0) {
    throw new Error(`Unsafe migration filename(s): ${invalid.sort().join(', ')}`);
  }

  const files = sqlNames.sort().map((name) => ({
    name,
    prefix: name.slice(0, 4),
    path: path.join(migrationsDir, name),
  }));
  if (files.length === 0) {
    throw new Error(`No migration files found in ${migrationsDir}`);
  }

  const prefixes = new Set();
  for (const file of files) {
    if (prefixes.has(file.prefix)) {
      throw new Error(`Duplicate migration prefix detected: ${file.prefix}`);
    }
    prefixes.add(file.prefix);
  }

  if (through && !files.some((file) => file.name === through)) {
    throw new Error(`--through migration was not found: ${through}`);
  }
  return files;
}

function buildMigrationPayload(name, sql) {
  if (!MIGRATION_FILE_PATTERN.test(name)) {
    throw new Error(`Unsafe migration filename: ${name}`);
  }
  const source = String(sql || '').replace(/^\uFEFF/, '');
  if (!source.trim()) throw new Error(`Migration is empty: ${name}`);
  if (source.includes('\0')) throw new Error(`Migration contains a NUL byte: ${name}`);
  if (/\bd1_migrations\b/i.test(source)) {
    throw new Error(`Migration must not modify the registry directly: ${name}`);
  }

  return [
    REGISTRY_TABLE_SQL,
    source.trimEnd(),
    `INSERT INTO d1_migrations (name) VALUES (${quoteSqlLiteral(name)});`,
    '',
  ].join('\n');
}

function buildTargetArgs(options) {
  if (options.mode === 'remote') return ['--remote'];
  return ['--local', '--persist-to', options.persistTo];
}

function buildRegistryQueryArgs(options) {
  return [
    'wrangler',
    'd1',
    'execute',
    options.database,
    '--config',
    options.config,
    '--command',
    REGISTRY_QUERY,
    '--json',
    ...buildTargetArgs(options),
  ];
}

function buildExecuteArgs(options, file) {
  return [
    'wrangler',
    'd1',
    'execute',
    options.database,
    '--config',
    options.config,
    '--file',
    file,
    '--yes',
    '--json',
    ...buildTargetArgs(options),
  ];
}

function readAppliedMigrations(options, runner = runWrangler) {
  try {
    const output = runner(buildRegistryQueryArgs(options), { cwd: options.cwd });
    return parseWranglerJson(output)
      .map((row) => String(row.name || ''))
      .filter(Boolean);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/no such table:\s*d1_migrations/i.test(message)) return [];
    throw error;
  }
}

function createMigrationPlan(files, appliedNames, through) {
  const knownNames = new Set(files.map((file) => file.name));
  const appliedSet = new Set(appliedNames);
  if (appliedSet.size !== appliedNames.length) {
    throw new Error('The d1_migrations registry contains duplicate names.');
  }

  const unknown = appliedNames.filter((name) => !knownNames.has(name));
  if (unknown.length > 0) {
    throw new Error(`Registry contains migration(s) missing from disk: ${unknown.join(', ')}`);
  }

  const expectedAppliedNames = files
    .slice(0, appliedNames.length)
    .map((file) => file.name);
  const expectedAppliedSet = new Set(expectedAppliedNames);
  if (appliedNames.some((name) => !expectedAppliedSet.has(name))) {
    throw new Error('Migration registry is not a contiguous prefix of files on disk.');
  }
  if (appliedNames.some((name, index) => name !== expectedAppliedNames[index])) {
    throw new Error('Migration registry order does not match the canonical file order.');
  }

  let foundGap = false;
  for (const file of files) {
    if (!appliedSet.has(file.name)) {
      foundGap = true;
    } else if (foundGap) {
      throw new Error(`Migration registry is not a contiguous prefix at ${file.name}.`);
    }
  }

  const throughIndex = through
    ? files.findIndex((file) => file.name === through)
    : files.length - 1;
  if (through && throughIndex < appliedNames.length - 1) {
    throw new Error(`Migration registry has already advanced beyond --through ${through}.`);
  }
  const selected = files.slice(0, throughIndex + 1);
  const pending = selected.filter((file) => !appliedSet.has(file.name));
  return {
    applied: files.filter((file) => appliedSet.has(file.name)).map((file) => file.name),
    pending,
    through: selected.at(-1)?.name || null,
  };
}

function applyPendingMigrations(rawOptions, dependencies = {}) {
  const options = normalizeOptions(rawOptions);
  const runner = dependencies.runWrangler || runWrangler;
  const files = listMigrationFiles(options.migrationsDir, options.through);
  const appliedBefore = readAppliedMigrations(options, runner);
  const plan = createMigrationPlan(files, appliedBefore, options.through);

  const report = {
    database: options.database,
    mode: options.mode,
    write: options.write,
    through: plan.through,
    appliedBefore: plan.applied.length,
    pending: plan.pending.map((file) => file.name),
    appliedNow: [],
    status: options.write ? 'applying' : 'dry-run',
  };
  if (!options.write || plan.pending.length === 0) {
    report.status = plan.pending.length === 0 ? 'up-to-date' : 'dry-run';
    return report;
  }

  for (const migration of plan.pending) {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tohieuquiz-d1-migration-'));
    const tempFile = path.join(tempDirectory, migration.name);
    try {
      const sql = fs.readFileSync(migration.path, 'utf8');
      fs.writeFileSync(tempFile, buildMigrationPayload(migration.name, sql), {
        encoding: 'utf8',
        mode: 0o600,
      });
      runner(buildExecuteArgs(options, tempFile), { cwd: options.cwd });
      const appliedAfter = readAppliedMigrations(options, runner);
      createMigrationPlan(files, appliedAfter);
      const expectedAppliedCount = appliedBefore.length + report.appliedNow.length + 1;
      if (
        appliedAfter.length !== expectedAppliedCount
        || appliedAfter.at(-1) !== migration.name
      ) {
        throw new Error(`Registry verification failed after ${migration.name}.`);
      }
      report.appliedNow.push(migration.name);
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  }

  report.status = 'applied';
  return report;
}

function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const report = applyPendingMigrations(cli);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  MIGRATION_FILE_PATTERN,
  REGISTRY_QUERY,
  REGISTRY_TABLE_SQL,
  applyPendingMigrations,
  buildExecuteArgs,
  buildMigrationPayload,
  buildRegistryQueryArgs,
  createMigrationPlan,
  listMigrationFiles,
  normalizeOptions,
  quoteSqlLiteral,
  readAppliedMigrations,
  readBareFlag,
};
