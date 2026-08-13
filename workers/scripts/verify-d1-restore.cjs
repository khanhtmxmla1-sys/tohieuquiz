#!/usr/bin/env node
'use strict';

const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  listBackupTables,
  parseCliArgs,
  parseWranglerJson,
  runWrangler,
} = require('./list-backup-tables.cjs');
const {
  assertOutsideRepository,
  decryptArchive,
  readRowCounts,
  sha256File,
} = require('./export-d1-tablewise.cjs');
const { REGISTRY_TABLE_SQL } = require('./apply-d1-migrations-safe.cjs');

const RESTORE_REGISTRY_SQL = REGISTRY_TABLE_SQL;

const FTS_REBUILD_SQL = [
  'DELETE FROM rag_chunks_fts;',
  'INSERT INTO rag_chunks_fts(chunk_id, source_path, title, section_title, content)',
  'SELECT chunks.id, documents.source_path, documents.title, chunks.section_title, chunks.content',
  'FROM rag_chunks AS chunks',
  'JOIN rag_documents AS documents ON documents.id = chunks.document_id;',
  "INSERT INTO rag_chunks_fts(rag_chunks_fts) VALUES('optimize');",
].join('\n');

const RESTORE_SMOKE_QUERY = [
  "SELECT",
  "(SELECT COUNT(*) FROM pragma_table_info('teachers') WHERE name IN ('username','password','status','token_version')) AS teacher_auth_columns,",
  "(SELECT COUNT(*) FROM pragma_table_info('students') WHERE name IN ('id','username','password_hash','class_id')) AS student_auth_columns,",
  "(SELECT COUNT(*) FROM quizzes) AS quizzes_count,",
  "(SELECT COUNT(*) FROM classes) AS classes_count,",
  "(SELECT COUNT(*) FROM results) AS results_count",
].join(' ');

function quoteSqlIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildDropTriggersSql(triggers) {
  return (Array.isArray(triggers) ? triggers : [])
    .map((trigger) => String(trigger?.name || '').trim())
    .filter(Boolean)
    .map((name) => `DROP TRIGGER IF EXISTS ${quoteSqlIdentifier(name)};`)
    .join('\n');
}

function buildClearSnapshotTablesSql(tables) {
  const uniqueTables = [...new Set(
    (Array.isArray(tables) ? tables : [])
      .map((table) => String(table || '').trim())
      .filter(Boolean),
  )];
  return [
    'PRAGMA foreign_keys=OFF;',
    ...uniqueTables.map((table) => `DELETE FROM ${quoteSqlIdentifier(table)};`),
    'PRAGMA foreign_keys=ON;',
  ].join('\n');
}

function buildRestoreTriggersSql(triggers) {
  return (Array.isArray(triggers) ? triggers : [])
    .map((trigger) => String(trigger?.sql || '').trim())
    .filter(Boolean)
    .map((sql) => `${sql.replace(/;+\s*$/, '')};`)
    .join('\n');
}

function compareRestoreSnapshot(expected, actual) {
  const missingTables = Object.keys(expected)
    .filter((table) => !(table in actual))
    .sort();
  const rowCountMismatches = Object.keys(expected)
    .filter((table) => table in actual && Number(expected[table]) !== Number(actual[table]))
    .sort()
    .map((table) => ({
      table,
      expected: Number(expected[table]),
      actual: Number(actual[table]),
    }));
  return {
    ok: missingTables.length === 0 && rowCountMismatches.length === 0,
    missingTables,
    rowCountMismatches,
  };
}

function localExecuteArgs(options) {
  const args = [
    'wrangler', 'd1', 'execute', options.database,
    '--config', options.config,
    '--local', '--persist-to', options.persistTo,
    '--yes',
  ];
  if (options.file) args.push('--file', options.file);
  if (options.command) args.push('--command', options.command);
  if (options.json) args.push('--json');
  return args;
}

function executeLocal(options) {
  return runWrangler(localExecuteArgs(options), { cwd: options.cwd });
}

function readLocalTriggers(options) {
  return parseWranglerJson(executeLocal({
    ...options,
    command: "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND sql IS NOT NULL ORDER BY name;",
    json: true,
  })).map((row) => ({
    name: String(row.name || ''),
    sql: String(row.sql || ''),
  })).filter((trigger) => trigger.name && trigger.sql);
}

function runRestoreSmoke(options) {
  const rows = parseWranglerJson(executeLocal({
    ...options,
    command: RESTORE_SMOKE_QUERY,
    json: true,
  }));
  const result = rows[0] || {};
  return {
    ok: Number(result.teacher_auth_columns) === 4 && Number(result.student_auth_columns) === 4,
    teacherAuthColumns: Number(result.teacher_auth_columns || 0),
    studentAuthColumns: Number(result.student_auth_columns || 0),
    quizzesCount: Number(result.quizzes_count || 0),
    classesCount: Number(result.classes_count || 0),
    resultsCount: Number(result.results_count || 0),
  };
}

async function assertEmptyTargetDirectory(target) {
  assertOutsideRepository(target.path, target.repositoryRoot);
  await fsp.mkdir(target.path, { recursive: true, mode: 0o700 });
  const entries = await fsp.readdir(target.path);
  if (entries.length > 0) {
    throw new Error(`Restore target must be an empty isolated directory: ${target.path}`);
  }
}

async function verifyD1Restore(options) {
  const startedAt = Date.now();
  const manifest = JSON.parse(await fsp.readFile(options.manifestPath, 'utf8'));
  if (manifest.formatVersion !== 1) throw new Error('Unsupported D1 backup manifest version.');
  if (manifest.database !== options.database) {
    throw new Error(`Manifest database mismatch: expected ${options.database}, found ${manifest.database}`);
  }
  const archiveHash = await sha256File(options.archive);
  if (archiveHash !== manifest.archive.sha256) throw new Error('Encrypted archive checksum mismatch.');
  await assertEmptyTargetDirectory({
    path: options.persistTo,
    repositoryRoot: options.repositoryRoot,
  });

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'tohieuquiz-d1-restore-'));
  const plaintext = path.join(tempDir, 'restore.sql');
  try {
    await decryptArchive({
      archive: options.archive,
      output: plaintext,
      passphrase: options.passphrase,
      encryption: manifest.archive.encryption,
    });
    executeLocal({ ...options, file: options.schemaPath });
    executeLocal({ ...options, command: RESTORE_REGISTRY_SQL });
    const triggers = readLocalTriggers(options);
    const dropTriggersSql = buildDropTriggersSql(triggers);
    if (dropTriggersSql) {
      executeLocal({ ...options, command: dropTriggersSql });
    }

    const snapshotReset = path.join(tempDir, 'reset-snapshot.sql');
    await fsp.writeFile(
      snapshotReset,
      `${buildClearSnapshotTablesSql(Object.keys(manifest.tables))}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
    executeLocal({ ...options, file: snapshotReset });
    executeLocal({ ...options, file: plaintext });

    const restoreTriggersSql = buildRestoreTriggersSql(triggers);
    if (restoreTriggersSql) {
      const triggerRestore = path.join(tempDir, 'restore-triggers.sql');
      await fsp.writeFile(triggerRestore, `${restoreTriggersSql}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      });
      executeLocal({ ...options, file: triggerRestore });
    }
    executeLocal({ ...options, command: FTS_REBUILD_SQL });

    const targetInfo = listBackupTables({
      database: options.database,
      config: options.config,
      mode: 'local',
      persistTo: options.persistTo,
      cwd: options.cwd,
    });
    const actualCounts = readRowCounts({
      ...options,
      mode: 'local',
      tables: Object.keys(manifest.tables),
    });
    const snapshot = compareRestoreSnapshot(manifest.tables, actualCounts);
    const schemaOk = targetInfo.schemaFingerprint === manifest.schemaFingerprint;
    const smoke = runRestoreSmoke(options);
    const ftsRows = parseWranglerJson(executeLocal({
      ...options,
      command: 'SELECT (SELECT COUNT(*) FROM rag_chunks_fts) AS fts_count, (SELECT COUNT(*) FROM rag_chunks JOIN rag_documents ON rag_documents.id = rag_chunks.document_id) AS source_count;',
      json: true,
    }))[0] || {};
    const ftsOk = Number(ftsRows.fts_count) === Number(ftsRows.source_count);
    const observedRestoreSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(3));
    const report = {
      verifiedAt: new Date().toISOString(),
      database: options.database,
      mode: 'local-isolated',
      ok: snapshot.ok && schemaOk && smoke.ok && ftsOk,
      schemaOk,
      snapshot,
      smoke,
      fts: {
        ok: ftsOk,
        indexedRows: Number(ftsRows.fts_count || 0),
        sourceRows: Number(ftsRows.source_count || 0),
      },
      observedBackupSeconds: Number(manifest.observedBackupSeconds || 0),
      observedRestoreSeconds,
      observedRpoSeconds: 0,
      notes: [
        'RPO is zero for this controlled local snapshot rehearsal.',
        'HTTP smoke is represented by auth/API database contract queries; no production or remote D1 was contacted.',
      ],
    };
    if (!report.ok) {
      throw new Error(`D1 restore verification failed: ${JSON.stringify(report)}`);
    }
    return report;
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  if (cli.remote) throw new Error('Restore verifier is local-only and refuses --remote.');
  const workersDir = path.resolve(__dirname, '..');
  const repositoryRoot = path.resolve(workersDir, '..');
  const archive = cli.archive ? path.resolve(String(cli.archive)) : '';
  const manifestPath = cli.manifest ? path.resolve(String(cli.manifest)) : '';
  const persistTo = cli['persist-to'] ? path.resolve(String(cli['persist-to'])) : '';
  if (!archive || !manifestPath || !persistTo) {
    throw new Error('--archive, --manifest and --persist-to are required.');
  }
  for (const externalPath of [archive, manifestPath, persistTo]) {
    assertOutsideRepository(externalPath, repositoryRoot);
  }
  if (cli.passphrase) {
    throw new Error('Do not pass backup passphrases on the command line; use --passphrase-env.');
  }
  const passphraseEnv = String(cli['passphrase-env'] || 'D1_BACKUP_PASSPHRASE');
  const passphrase = process.env[passphraseEnv];
  if (!passphrase) throw new Error(`Missing passphrase environment variable: ${passphraseEnv}`);

  const report = await verifyD1Restore({
    archive,
    manifestPath,
    persistTo,
    passphrase,
    database: String(cli.database || 'tohieuquiz-db'),
    config: String(cli.config || 'wrangler.toml'),
    schemaPath: cli.schema ? path.resolve(String(cli.schema)) : path.join(workersDir, 'schema.sql'),
    repositoryRoot,
    cwd: workersDir,
  });
  const reportPath = `${manifestPath.replace(/\.manifest\.json$/, '')}.restore-report.json`;
  await fsp.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  process.stdout.write(`${JSON.stringify({ report: reportPath, ...report }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  FTS_REBUILD_SQL,
  RESTORE_REGISTRY_SQL,
  RESTORE_SMOKE_QUERY,
  buildClearSnapshotTablesSql,
  buildDropTriggersSql,
  buildRestoreTriggersSql,
  compareRestoreSnapshot,
  localExecuteArgs,
  runRestoreSmoke,
  verifyD1Restore,
};
