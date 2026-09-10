#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  buildMigrationPayload,
  REGISTRY_TABLE_SQL,
} = require('./apply-d1-migrations-safe.cjs');
const {
  assertOutsideRepository,
} = require('./export-d1-tablewise.cjs');
const {
  listBackupTables,
  parseCliArgs,
  parseWranglerJson,
  runWrangler,
} = require('./list-backup-tables.cjs');

const BASELINE_MIGRATION = '0068_login_media.sql';
const BASELINE_MARKER = '-- Canonical migration 0069_competition_core.sql';
const COMPETITION_MIGRATIONS = Object.freeze([
  '0069_competition_core.sql',
  '0070_competition_school_exam.sql',
  '0071_live_exam_capacity_profiles.sql',
  '0072_competition_school_exam_orchestration.sql',
  '0073_competition_school_exam_reconcile.sql',
  '0074_competition_school_exam_incident_retest.sql',
  '0075_competition_school_exam_publication_ranking.sql',
  '0076_competition_certificate_adapter.sql',
  '0077_competition_async_xlsx_export.sql',
  '0078_competition_result_corrections.sql',
  '0079_competition_runtime_rollout.sql',
  '0080_competition_public_portal.sql',
  '0081_competition_school_exam_admissions.sql',
]);

const expectedCompetitionTables = Object.freeze([
  'competition_campaigns',
  'competition_audience_snapshots',
  'competition_audience_members',
  'competition_quiz_snapshots',
  'competition_rounds',
  'competition_round_quizzes',
  'competition_round_attempts',
  'competition_round_progress',
  'competition_eligibility',
  'competition_school_exam_admissions',
  'competition_school_exam_events',
  'competition_school_exam_rooms',
  'competition_school_exam_members',
  'competition_school_exam_results',
  'competition_school_exam_incidents',
  'competition_school_exam_retests',
  'competition_school_exam_reconcile_runs',
  'competition_school_exam_reconcile_issues',
  'competition_school_exam_result_history',
  'competition_school_exam_publications',
  'competition_school_exam_publication_results',
  'competition_school_exam_exports',
  'competition_school_exam_certificate_batches',
  'competition_school_exam_certificate_batch_items',
  'competition_school_exam_audit',
  'competition_school_exam_result_corrections',
  'live_exam_capacity_profiles',
]);

const protectedExistingTables = Object.freeze([
  'teachers',
  'classes',
  'students',
  'quizzes',
  'results',
  'live_exam_sessions',
  'live_exam_participants',
  'live_exam_activity',
  'live_exam_answer_snapshots',
  'live_exam_connection_events',
]);

const requiredLiveExamColumns = Object.freeze([
  'participant_scope_type',
  'participant_scope_id',
  'result_visibility',
]);
const MAX_SQL_FILE_BYTES = 64 * 1024;
// Wrangler's local D1 adapter enforces a small compound-SELECT term limit.
const ROW_COUNT_BATCH_SIZE = 5;

function quoteSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quoteSqlIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < String(sql).length; index += 1) {
    const char = String(sql)[index];
    const next = String(sql)[index + 1];
    if (lineComment) {
      current += char;
      if (char === '\n' || char === '\r') lineComment = false;
      continue;
    }
    if (blockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }
    if (quote) {
      current += char;
      if (char === quote) {
        if (next === quote) {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === '-' && next === '-') {
      current += char + next;
      index += 1;
      lineComment = true;
      continue;
    }
    if (char === '/' && next === '*') {
      current += char + next;
      index += 1;
      blockComment = true;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      current += char;
      quote = char;
      continue;
    }
    if (char === ';') {
      const trigger = /CREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\b/i.test(current);
      const triggerClose = /(?:^|\r?\n)\s*END\s*$/i.test(current);
      if (trigger && !triggerClose) {
        current += char;
        continue;
      }
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function chunkSqlStatements(sql, maxBytes = MAX_SQL_FILE_BYTES) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1024) {
    throw new Error('SQL chunk size must be at least 1024 bytes.');
  }
  const chunks = [];
  let current = '';
  for (const statement of splitSqlStatements(sql)) {
    const serialized = `${statement};\n`;
    if (current && Buffer.byteLength(current + serialized, 'utf8') > maxBytes) {
      chunks.push(current);
      current = '';
    }
    if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
      throw new Error(`SQL statement exceeds chunk limit (${maxBytes} bytes).`);
    }
    current += serialized;
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildRegistrySeedSql(names) {
  const registryNames = Array.isArray(names) && names.length > 0
    ? names
    : [BASELINE_MIGRATION];
  return [
    REGISTRY_TABLE_SQL,
    ...registryNames.map((name) => (
      `INSERT INTO d1_migrations (name) VALUES (${quoteSqlLiteral(name)});`
    )),
    '',
  ].join('\n');
}

function build0068BaselineSql(schemaSql, registryNames = [BASELINE_MIGRATION]) {
  const source = String(schemaSql || '').replace(/^\uFEFF/, '');
  const markerIndex = source.indexOf(BASELINE_MARKER);
  if (markerIndex < 0) {
    throw new Error(`Canonical schema marker not found: ${BASELINE_MARKER}`);
  }
  const baseline = source.slice(0, markerIndex).trimEnd();
  if (!baseline) throw new Error('Migration-0068 baseline schema is empty.');
  return `${baseline}\n\n${buildRegistrySeedSql(registryNames)}`;
}

function summarizeRowDeltas(before = {}, after = {}) {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changedExistingTables = names
    .filter((table) => table in before && table in after && Number(before[table]) !== Number(after[table]))
    .map((table) => ({
      table,
      before: Number(before[table]),
      after: Number(after[table]),
    }));
  const addedTables = names
    .filter((table) => !(table in before) && table in after)
    .map((table) => ({
      table,
      before: 0,
      after: Number(after[table]),
    }));
  return { changedExistingTables, addedTables };
}

function evaluateRehearsalOutcome({
  emptyBootstrap,
  forward0068,
  representative,
  applicationRollback,
}) {
  const blockingGaps = [];
  if (!emptyBootstrap) blockingGaps.push('empty_bootstrap_failed');
  if (!forward0068) blockingGaps.push('migration_0068_forward_failed');
  if (!representative) blockingGaps.push('representative_snapshot_missing');
  if (!applicationRollback) blockingGaps.push('application_rollback_evidence_missing');
  return {
    status: blockingGaps.length === 0 ? 'PASS' : 'BLOCKED',
    blockingGaps,
  };
}

function createQueryArgs(options, command) {
  return [
    'wrangler',
    'd1',
    'execute',
    options.database,
    '--config',
    options.config,
    '--command',
    command,
    '--json',
    '--local',
    '--persist-to',
    options.persistTo,
  ];
}

function createFileArgs(options, file) {
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
    '--local',
    '--persist-to',
    options.persistTo,
  ];
}

function executeCommand(options, command) {
  return parseWranglerJson(runWrangler(createQueryArgs(options, command), { cwd: options.cwd }));
}

function executeFile(options, file) {
  return parseWranglerJson(runWrangler(createFileArgs(options, file), { cwd: options.cwd }));
}

function executeSqlText(options, sql, prefix) {
  const chunks = chunkSqlStatements(sql);
  for (const [index, chunk] of chunks.entries()) {
    const temp = makeTempSqlFile(chunk, `${prefix}-`, `chunk-${index + 1}.sql`);
    try {
      executeFile(options, temp.file);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${prefix} chunk ${index + 1}/${chunks.length} failed: ${detail}\n${chunk.slice(0, 500)}`,
        { cause: error },
      );
    } finally {
      removeTempDirectory(temp.directory);
    }
  }
}

function readRegistry(options) {
  try {
    return executeCommand(options, 'SELECT name FROM d1_migrations ORDER BY id;')
      .map((row) => String(row.name || ''))
      .filter(Boolean);
  } catch (error) {
    if (/no such table:\s*d1_migrations/i.test(String(error))) return [];
    throw error;
  }
}

function readRowCounts(options, tables) {
  if (tables.length === 0) return {};
  const counts = {};
  for (let index = 0; index < tables.length; index += ROW_COUNT_BATCH_SIZE) {
    const batch = tables.slice(index, index + ROW_COUNT_BATCH_SIZE);
    const query = batch
      .map((table) => (
        `SELECT ${quoteSqlLiteral(table)} AS table_name, COUNT(*) AS row_count FROM ${quoteSqlIdentifier(table)}`
      ))
      .join(' UNION ALL ');
    for (const row of executeCommand(options, query)) {
      counts[String(row.table_name)] = Number(row.row_count);
    }
  }
  return counts;
}

function readForeignKeyViolations(options) {
  return executeCommand(options, 'PRAGMA foreign_key_check;');
}

function readColumns(options, table) {
  return executeCommand(options, `PRAGMA table_info(${quoteSqlIdentifier(table)});`)
    .map((row) => String(row.name || ''))
    .filter(Boolean);
}

function expectedTablesFromMigrations(migrationsDir, migrations = COMPETITION_MIGRATIONS) {
  const names = new Set();
  for (const migration of migrations) {
    const source = fs.readFileSync(path.join(migrationsDir, migration), 'utf8');
    for (const match of source.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][A-Za-z0-9_]*)/gi)) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
}

function expectedIndexesFromMigrations(migrationsDir, migrations = COMPETITION_MIGRATIONS) {
  const names = new Set();
  for (const migration of migrations) {
    const source = fs.readFileSync(path.join(migrationsDir, migration), 'utf8');
    for (const match of source.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([A-Za-z_][A-Za-z0-9_]*)/gi)) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
}

function captureState(options, integrity = {}) {
  const tableInfo = listBackupTables(options);
  const registry = readRegistry(options);
  const expectedTables = integrity.tables || [];
  const expectedIndexes = integrity.indexes || [];
  const rowCounts = readRowCounts(options, [
    ...protectedExistingTables,
    ...expectedTables,
  ].filter((table) => tableInfo.exportTables.includes(table)));
  const entryNames = new Set(tableInfo.entries.map((entry) => String(entry.name || '')));
  const missingTables = expectedTables.filter((table) => !entryNames.has(table));
  const missingIndexes = expectedIndexes.filter((index) => !entryNames.has(index));
  const foreignKeyViolations = readForeignKeyViolations(options);
  const liveExamColumns = readColumns(options, 'live_exam_sessions');
  const liveExamColumnsOk = integrity.requireLiveExamColumns === true
    ? requiredLiveExamColumns.every((column) => liveExamColumns.includes(column))
    : true;
  return {
    capturedAt: new Date().toISOString(),
    registry,
    rowCounts,
    schemaFingerprint: tableInfo.schemaFingerprint,
    missingTables,
    missingIndexes,
    foreignKeyViolations,
    liveExamColumns,
    integrityOk: missingTables.length === 0
      && missingIndexes.length === 0
      && foreignKeyViolations.length === 0
      && liveExamColumnsOk,
  };
}

function makeTempSqlFile(contents, prefix, name) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const file = path.join(directory, name);
  fs.writeFileSync(file, contents, { encoding: 'utf8', mode: 0o600 });
  return { directory, file };
}

function removeTempDirectory(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

function assertEmptyDirectory(directory, repositoryRoot) {
  assertOutsideRepository(directory, repositoryRoot);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.readdirSync(directory).length > 0) {
    throw new Error(`Rehearsal state directory must be empty: ${directory}`);
  }
}

function readCandidateSha(cwd, candidateSha) {
  if (candidateSha) return String(candidateSha);
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
}

function runMigrationWindow(options, beforeState) {
  const migrationResults = [];
  let previousState = beforeState;
  for (const [migrationIndex, migration] of COMPETITION_MIGRATIONS.entries()) {
    const migrationPath = path.join(options.migrationsDir, migration);
    const payload = buildMigrationPayload(migration, fs.readFileSync(migrationPath, 'utf8'));
    const temp = makeTempSqlFile(payload, 'tohieuquiz-competition-migration-', migration);
    const startedAt = Date.now();
    try {
      executeFile(options, temp.file);
      const appliedMigrations = COMPETITION_MIGRATIONS.slice(0, migrationIndex + 1);
      const afterState = captureState(options, {
        tables: expectedTablesFromMigrations(options.migrationsDir, appliedMigrations),
        indexes: expectedIndexesFromMigrations(options.migrationsDir, appliedMigrations),
        requireLiveExamColumns: appliedMigrations.includes('0070_competition_school_exam.sql'),
      });
      const expectedRegistryLength = previousState.registry.length + 1;
      const registryOk = afterState.registry.length === expectedRegistryLength
        && afterState.registry.at(-1) === migration;
      migrationResults.push({
        migration,
        status: registryOk && afterState.integrityOk ? 'PASS' : 'FAIL',
        durationMs: Date.now() - startedAt,
        registryAfter: afterState.registry,
        rowDeltas: summarizeRowDeltas(previousState.rowCounts, afterState.rowCounts),
        integrityOk: afterState.integrityOk,
        errors: registryOk ? [] : ['registry_verification_failed'],
      });
      if (!registryOk || !afterState.integrityOk) {
        return { status: 'FAIL', migrationResults, beforeState, afterState };
      }
      previousState = afterState;
    } catch (error) {
      migrationResults.push({
        migration,
        status: 'FAIL',
        durationMs: Date.now() - startedAt,
        registryAfter: readRegistry(options),
        rowDeltas: { changedExistingTables: [], addedTables: [] },
        integrityOk: false,
        errors: [String(error instanceof Error ? error.message : error)],
      });
      return { status: 'FAIL', migrationResults, beforeState, afterState: null };
    } finally {
      removeTempDirectory(temp.directory);
    }
  }
  return { status: 'PASS', migrationResults, beforeState, afterState: previousState };
}

function runEmptyBootstrap(options, schemaPath, registryPath) {
  const statePath = path.join(options.persistRoot, 'empty-bootstrap');
  assertEmptyDirectory(statePath, options.repositoryRoot);
  const scenarioOptions = { ...options, persistTo: statePath };
  executeSqlText(scenarioOptions, fs.readFileSync(schemaPath, 'utf8'), 'tohieuquiz-competition-schema');
  executeSqlText(scenarioOptions, fs.readFileSync(registryPath, 'utf8'), 'tohieuquiz-competition-registry');
  const state = captureState(scenarioOptions, {
    tables: expectedCompetitionTables,
    indexes: expectedIndexesFromMigrations(options.migrationsDir),
    requireLiveExamColumns: true,
  });
  const registryOk = state.registry.length > 0
    && state.registry.at(-1) === COMPETITION_MIGRATIONS.at(-1);
  return {
    status: registryOk && state.integrityOk ? 'PASS' : 'FAIL',
    state,
    registryOk,
  };
}

function runForwardScenario(options, baselineSql, scenarioName, snapshotHash) {
  const statePath = path.join(options.persistRoot, scenarioName);
  assertEmptyDirectory(statePath, options.repositoryRoot);
  const scenarioOptions = { ...options, persistTo: statePath };
  const baseline = makeTempSqlFile(baselineSql, 'tohieuquiz-competition-baseline-', `${scenarioName}.sql`);
  try {
    executeSqlText(scenarioOptions, fs.readFileSync(baseline.file, 'utf8'), 'tohieuquiz-competition-baseline-statement');
    const beforeState = captureState(scenarioOptions);
    const baselineRegistryOk = beforeState.registry.at(-1) === BASELINE_MIGRATION;
    if (!baselineRegistryOk) {
      return {
        status: 'FAIL',
        snapshotHash,
        baselineRegistryOk,
        beforeState,
        afterState: null,
        migrationResults: [],
        rowDeltas: null,
      };
    }
    const forward = runMigrationWindow(scenarioOptions, beforeState);
    const protectedDeltas = summarizeRowDeltas(
      Object.fromEntries(protectedExistingTables.map((table) => [table, beforeState.rowCounts[table] || 0])),
      Object.fromEntries(protectedExistingTables.map((table) => [table, forward.afterState?.rowCounts?.[table] || 0])),
    );
    return {
      ...forward,
      snapshotHash,
      baselineRegistryOk,
      rowDeltas: protectedDeltas,
      liveExamDataUnchanged: protectedDeltas.changedExistingTables.length === 0,
    };
  } finally {
    removeTempDirectory(baseline.directory);
  }
}

function normalizeOptions(cli) {
  const workersDir = path.resolve(__dirname, '..');
  const repositoryRoot = path.resolve(workersDir, '..');
  if (cli.remote) throw new Error('Competition migration rehearsal is local-only and refuses --remote.');
  const persistRoot = path.resolve(String(cli['persist-to'] || ''));
  if (!persistRoot || persistRoot === path.resolve('.')) {
    throw new Error('--persist-to must point to a new isolated directory outside the repository.');
  }
  const output = path.resolve(String(cli.output || ''));
  if (!output) throw new Error('--output is required.');
  assertOutsideRepository(persistRoot, repositoryRoot);
  assertOutsideRepository(output, repositoryRoot);
  if (fs.existsSync(persistRoot) && fs.readdirSync(persistRoot).length > 0) {
    throw new Error(`--persist-to must be empty: ${persistRoot}`);
  }
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite evidence report: ${output}`);
  return {
    database: String(cli.database || 'tohieuquiz-db'),
    config: path.resolve(workersDir, String(cli.config || 'wrangler.toml')),
    cwd: workersDir,
    workersDir,
    repositoryRoot,
    migrationsDir: path.join(workersDir, 'migrations'),
    schemaPath: path.join(workersDir, 'schema.sql'),
    registryPath: path.join(workersDir, 'scripts', 'bootstrap_d1_migration_registry.sql'),
    persistRoot,
    output,
    candidateSha: readCandidateSha(repositoryRoot, cli['candidate-sha']),
    representativeSql: cli['representative-sql']
      ? path.resolve(String(cli['representative-sql']))
      : null,
    rollbackEvidence: cli['rollback-evidence']
      ? path.resolve(String(cli['rollback-evidence']))
      : null,
  };
}

function readRollbackEvidence(file) {
  if (!file) return { ok: false, source: null };
  const evidence = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    ok: evidence.ok === true && evidence.preservesCompetitionData === true,
    source: file,
  };
}

function runRehearsal(rawOptions) {
  const options = normalizeOptions(rawOptions);
  fs.mkdirSync(options.persistRoot, { recursive: true, mode: 0o700 });
  const schemaSql = fs.readFileSync(options.schemaPath, 'utf8');
  const bootstrapSql = fs.readFileSync(options.registryPath, 'utf8');
  const baselineRegistryNames = [...bootstrapSql.matchAll(/\('([^']+\.sql)'\)/g)]
    .map((match) => match[1])
    .filter((name) => name <= BASELINE_MIGRATION);
  const baselineSql = build0068BaselineSql(schemaSql, baselineRegistryNames);
  const empty = runEmptyBootstrap(options, options.schemaPath, options.registryPath);
  const from0068 = runForwardScenario(
    options,
    baselineSql,
    'from-0068',
    crypto.createHash('sha256').update(baselineSql).digest('hex'),
  );
  let representative = {
    status: 'BLOCKED',
    reason: 'representative_snapshot_missing',
    snapshotHash: null,
  };
  if (options.representativeSql) {
    assertOutsideRepository(options.representativeSql, options.repositoryRoot);
    if (!fs.existsSync(options.representativeSql)) {
      representative = { status: 'FAIL', reason: 'representative_snapshot_not_found' };
    } else {
      representative = runForwardScenario(
        options,
        fs.readFileSync(options.representativeSql, 'utf8'),
        'representative',
        crypto.createHash('sha256').update(fs.readFileSync(options.representativeSql)).digest('hex'),
      );
    }
  }
  const rollback = readRollbackEvidence(options.rollbackEvidence);
  const outcome = evaluateRehearsalOutcome({
    emptyBootstrap: empty.status === 'PASS',
    forward0068: from0068.status === 'PASS' && from0068.liveExamDataUnchanged,
    representative: representative.status === 'PASS',
    applicationRollback: rollback.ok,
  });
  return {
    reportVersion: 1,
    evidenceType: 'competition-migration-rehearsal',
    generatedAt: new Date().toISOString(),
    candidateSha: options.candidateSha,
    operator: process.env.USERNAME || process.env.USER || 'unknown',
    environment: {
      mode: 'local-isolated',
      node: process.version,
      platform: process.platform,
      database: options.database,
    },
    migrationWindow: {
      registryBefore: BASELINE_MIGRATION,
      registryAfter: COMPETITION_MIGRATIONS.at(-1),
      files: [...COMPETITION_MIGRATIONS],
    },
    output: options.output,
    status: outcome.status,
    blockingGaps: outcome.blockingGaps,
    scenarios: {
      emptyBootstrap: empty,
      from0068,
      representative,
    },
    applicationRollback: rollback,
    notes: [
      'All D1 operations were local-only and used isolated --persist-to directories.',
      'No production or remote D1 write was attempted.',
      'WP3 cannot pass without an approved representative snapshot and rollback evidence.',
    ],
  };
}

function main() {
  const report = runRehearsal(parseCliArgs(process.argv.slice(2)));
  fs.mkdirSync(path.dirname(report.output || ''), { recursive: true });
  fs.writeFileSync(report.output, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  process.stdout.write(`${JSON.stringify({
    status: report.status,
    report: report.output,
    candidateSha: report.candidateSha,
    blockingGaps: report.blockingGaps,
  }, null, 2)}\n`);
  if (report.status === 'FAIL') process.exitCode = 1;
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
  BASELINE_MARKER,
  BASELINE_MIGRATION,
  COMPETITION_MIGRATIONS,
  build0068BaselineSql,
  buildRegistrySeedSql,
  evaluateRehearsalOutcome,
  expectedCompetitionTables,
  expectedTablesFromMigrations,
  chunkSqlStatements,
  expectedIndexesFromMigrations,
  splitSqlStatements,
  summarizeRowDeltas,
  runRehearsal,
};
