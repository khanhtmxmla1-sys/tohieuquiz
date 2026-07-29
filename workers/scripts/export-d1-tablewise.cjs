#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const zlib = require('node:zlib');
const {
  listBackupTables,
  parseCliArgs,
  parseWranglerJson,
  runWrangler,
} = require('./list-backup-tables.cjs');

function isWithin(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertOutsideRepository(candidate, repositoryRoot) {
  if (isWithin(candidate, repositoryRoot)) {
    throw new Error(`Backup output must be outside the repository: ${candidate}`);
  }
}

function validatePassphrase(passphrase) {
  if (typeof passphrase !== 'string' || passphrase.length < 16) {
    throw new Error('Backup passphrase must contain at least 16 characters.');
  }
}

function buildExportArgs(options) {
  if (!Array.isArray(options.tables) || options.tables.length === 0) {
    throw new Error('At least one regular table is required for export.');
  }
  if (options.mode !== 'remote') {
    throw new Error('Local persistence must be exported with the node:sqlite adapter.');
  }
  if (options.confirmRemote !== options.database) {
    throw new Error(`Remote export requires --confirm-remote ${options.database}`);
  }

  const args = [
    'wrangler',
    'd1',
    'export',
    options.database,
    '--config',
    options.config,
    '--output',
    options.output,
    '--no-schema',
    '--skip-confirmation',
    '--remote',
  ];
  for (const table of options.tables) {
    args.push('--table', table);
  }
  return args;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function buildRowCountQuery(tables) {
  return tables
    .map((table) => `SELECT '${String(table).replaceAll("'", "''")}' AS table_name, COUNT(*) AS row_count FROM ${quoteIdentifier(table)}`)
    .join(' UNION ALL ');
}

function chunkValues(values, size = 5) {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('Chunk size must be a positive integer.');
  }
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function findLocalD1File(persistTo) {
  const candidates = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(candidate);
      } else if (entry.name.endsWith('.sqlite') && entry.name !== 'metadata.sqlite') {
        candidates.push(candidate);
      }
    }
  }
  walk(path.resolve(persistTo));
  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one local D1 SQLite file, found ${candidates.length}.`);
  }
  return candidates[0];
}

function openLocalD1(persistTo) {
  const { DatabaseSync } = require('node:sqlite');
  return new DatabaseSync(findLocalD1File(persistTo), { readOnly: true });
}

function serializeSqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot serialize a non-finite SQLite number.');
    return String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return `X'${Buffer.from(value).toString('hex')}'`;
  }
  throw new Error(`Unsupported SQLite value type: ${typeof value}`);
}

function dumpLocalTables({ persistTo, output, tables }) {
  const database = openLocalD1(persistTo);
  const fd = fs.openSync(output, 'wx', 0o600);
  try {
    fs.writeSync(fd, 'PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n');
    for (const table of tables) {
      const statement = database.prepare(`SELECT * FROM ${quoteIdentifier(table)}`);
      statement.setReadBigInts(true);
      const columns = statement.columns().map((column) => column.name);
      if (columns.length === 0) continue;
      const columnSql = columns.map(quoteIdentifier).join(', ');
      for (const row of statement.iterate()) {
        const values = columns.map((column) => serializeSqlValue(row[column])).join(', ');
        fs.writeSync(
          fd,
          `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES (${values});\n`,
        );
      }
    }
    fs.writeSync(fd, 'COMMIT;\nPRAGMA foreign_keys=ON;\n');
  } finally {
    fs.closeSync(fd);
    database.close();
  }
}

function readLocalRowCounts(options) {
  const database = openLocalD1(options.persistTo);
  try {
    return Object.fromEntries(options.tables.map((table) => {
      const row = database.prepare(`SELECT COUNT(*) AS row_count FROM ${quoteIdentifier(table)}`).get();
      return [table, Number(row.row_count)];
    }));
  } finally {
    database.close();
  }
}

function readRowCounts(options) {
  if (options.tables.length === 0) return {};
  if (options.mode !== 'remote') return readLocalRowCounts(options);
  if (options.confirmRemote !== options.database) {
    throw new Error(`Remote row count requires --confirm-remote ${options.database}`);
  }
  const counts = {};
  for (const tableBatch of chunkValues(options.tables)) {
    const args = [
      'wrangler', 'd1', 'execute', options.database,
      '--config', options.config,
      '--command', buildRowCountQuery(tableBatch),
      '--json', '--remote',
    ];
    const rows = parseWranglerJson(runWrangler(args, { cwd: options.cwd }));
    for (const row of rows) counts[row.table_name] = Number(row.row_count);
  }
  return counts;
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest('hex');
}

async function encryptArchive({ source, archive, passphrase }) {
  validatePassphrase(passphrase);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  await pipeline(
    fs.createReadStream(source),
    zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }),
    cipher,
    fs.createWriteStream(archive, { flags: 'wx', mode: 0o600 }),
  );
  return {
    algorithm: 'aes-256-gcm',
    compression: 'gzip',
    keyDerivation: 'scrypt',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

async function decryptArchive({ archive, output, passphrase, encryption }) {
  validatePassphrase(passphrase);
  if (encryption.algorithm !== 'aes-256-gcm' || encryption.compression !== 'gzip') {
    throw new Error('Unsupported D1 backup encryption format.');
  }
  const key = crypto.scryptSync(passphrase, Buffer.from(encryption.salt, 'base64'), 32);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encryption.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(encryption.authTag, 'base64'));
  await pipeline(
    fs.createReadStream(archive),
    decipher,
    zlib.createGunzip(),
    fs.createWriteStream(output, { flags: 'wx', mode: 0o600 }),
  );
}

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function exportD1Tablewise(options) {
  const startedAt = Date.now();
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const outputDir = path.resolve(options.outputDir);
  assertOutsideRepository(outputDir, repositoryRoot);
  validatePassphrase(options.passphrase);
  await fsp.mkdir(outputDir, { recursive: true, mode: 0o700 });

  const tableInfo = listBackupTables(options);
  const rowCounts = readRowCounts({ ...options, tables: tableInfo.exportTables });
  const prefix = `tohieuquiz-d1-${safeTimestamp()}`;
  const plaintext = path.join(outputDir, `${prefix}.sql`);
  const archive = path.join(outputDir, `${prefix}.sql.gz.enc`);
  const manifestPath = path.join(outputDir, `${prefix}.manifest.json`);
  for (const target of [plaintext, archive, manifestPath]) {
    assertOutsideRepository(target, repositoryRoot);
  }

  try {
    if (options.mode === 'remote') {
      const exportArgs = buildExportArgs({
        ...options,
        output: plaintext,
        tables: tableInfo.exportTables,
      });
      runWrangler(exportArgs, { cwd: options.cwd });
      await fsp.chmod(plaintext, 0o600);
    } else {
      dumpLocalTables({
        persistTo: options.persistTo,
        output: plaintext,
        tables: tableInfo.exportTables,
      });
    }
    const encryption = await encryptArchive({
      source: plaintext,
      archive,
      passphrase: options.passphrase,
    });
    const manifest = {
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      database: options.database,
      mode: options.mode,
      schemaFingerprint: tableInfo.schemaFingerprint,
      tables: rowCounts,
      excluded: {
        virtualTables: tableInfo.virtualTables,
        shadowTables: tableInfo.shadowTables,
        systemTables: tableInfo.systemTables,
      },
      archive: {
        fileName: path.basename(archive),
        sha256: await sha256File(archive),
        encryption,
      },
      observedBackupSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(3)),
    };
    await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    return { archive, manifestPath, manifest };
  } finally {
    await fsp.rm(plaintext, { force: true });
  }
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const workersDir = path.resolve(__dirname, '..');
  const repositoryRoot = path.resolve(workersDir, '..');
  const database = String(cli.database || 'tohieuquiz-db');
  const mode = cli.remote ? 'remote' : 'local';
  const outputDir = cli['output-dir'] ? path.resolve(String(cli['output-dir'])) : '';
  if (!outputDir) throw new Error('--output-dir is required.');
  if (cli.passphrase) {
    throw new Error('Do not pass backup passphrases on the command line; use --passphrase-env.');
  }
  const passphraseEnv = String(cli['passphrase-env'] || 'D1_BACKUP_PASSPHRASE');
  const passphrase = process.env[passphraseEnv];
  if (!passphrase) throw new Error(`Missing passphrase environment variable: ${passphraseEnv}`);

  const result = await exportD1Tablewise({
    database,
    config: String(cli.config || 'wrangler.toml'),
    mode,
    persistTo: cli['persist-to'] ? path.resolve(String(cli['persist-to'])) : undefined,
    confirmRemote: cli['confirm-remote'] ? String(cli['confirm-remote']) : undefined,
    outputDir,
    repositoryRoot,
    passphrase,
    cwd: workersDir,
  });
  process.stdout.write(`${JSON.stringify({
    archive: result.archive,
    manifest: result.manifestPath,
    tableCount: Object.keys(result.manifest.tables).length,
    observedBackupSeconds: result.manifest.observedBackupSeconds,
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  assertOutsideRepository,
  buildExportArgs,
  buildRowCountQuery,
  chunkValues,
  decryptArchive,
  dumpLocalTables,
  encryptArchive,
  exportD1Tablewise,
  findLocalD1File,
  readLocalRowCounts,
  readRowCounts,
  serializeSqlValue,
  sha256File,
  validatePassphrase,
};
