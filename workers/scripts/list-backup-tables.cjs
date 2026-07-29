#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MASTER_TABLE_QUERY = [
  "SELECT name, type, tbl_name, sql",
  "FROM sqlite_master",
  "WHERE type IN ('table', 'view', 'index', 'trigger')",
  "ORDER BY type, name",
].join(' ');

function parseCliArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      values[key] = true;
    } else {
      values[key] = next;
      index += 1;
    }
  }
  return values;
}

function normalizeMode(options) {
  const mode = options.mode || (options.remote ? 'remote' : 'local');
  if (!['local', 'remote'].includes(mode)) {
    throw new Error(`Unsupported D1 mode: ${mode}`);
  }
  if (mode === 'remote' && options.confirmRemote !== options.database) {
    throw new Error(`Remote D1 access requires --confirm-remote ${options.database}`);
  }
  if (mode === 'local' && !options.persistTo) {
    throw new Error('Local D1 access requires --persist-to for an isolated database state.');
  }
  return mode;
}

function buildListTablesArgs(options) {
  const mode = normalizeMode(options);
  const args = [
    'wrangler',
    'd1',
    'execute',
    options.database,
    '--config',
    options.config,
    '--command',
    MASTER_TABLE_QUERY,
    '--json',
  ];
  if (mode === 'local') {
    args.push('--local', '--persist-to', options.persistTo);
  } else {
    args.push('--remote');
  }
  return args;
}

function parseWranglerJson(output) {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start < 0 || end < start) {
    throw new Error('Wrangler did not return a JSON array.');
  }
  const payload = JSON.parse(output.slice(start, end + 1));
  return payload.flatMap((entry) => Array.isArray(entry.results) ? entry.results : []);
}

function runWrangler(args, options = {}) {
  const cwd = options.cwd || path.resolve(__dirname, '..');
  const wranglerBin = path.join(cwd, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  if (!fs.existsSync(wranglerBin)) {
    throw new Error(`Wrangler binary not found. Run npm ci in ${cwd}.`);
  }
  const result = spawnSync(process.execPath, [wranglerBin, ...args.slice(1)], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Wrangler failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function classifyTableEntries(entries) {
  const virtualTables = entries
    .filter((entry) => /CREATE\s+VIRTUAL\s+TABLE/i.test(entry.sql || ''))
    .map((entry) => entry.name)
    .sort();
  const virtualPrefixes = virtualTables.map((name) => `${name}_`);
  const systemTables = [];
  const shadowTables = [];
  const exportTables = [];

  for (const entry of entries) {
    if (entry.type !== 'table') continue;
    const name = String(entry.name || '');
    if (!name) continue;
    if (name.startsWith('sqlite_') || name.startsWith('_cf_')) {
      systemTables.push(name);
    } else if (virtualTables.includes(name)) {
      // Virtual tables are rebuilt from canonical source tables after restore.
    } else if (virtualPrefixes.some((prefix) => name.startsWith(prefix))) {
      shadowTables.push(name);
    } else if (entry.type === 'table') {
      exportTables.push(name);
    }
  }

  return {
    exportTables: exportTables.sort(),
    virtualTables,
    shadowTables: shadowTables.sort(),
    systemTables: systemTables.sort(),
  };
}

function stripSqlComments(sql) {
  const source = String(sql || '');
  let output = '';
  let quoteEnd = '';

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (quoteEnd) {
      output += current;
      if (current !== quoteEnd) continue;
      if (next === quoteEnd) {
        output += next;
        index += 1;
      } else {
        quoteEnd = '';
      }
      continue;
    }

    if (current === "'" || current === '"' || current === '`') {
      quoteEnd = current;
      output += current;
      continue;
    }
    if (current === '[') {
      quoteEnd = ']';
      output += current;
      continue;
    }
    if (current === '-' && next === '-') {
      output += ' ';
      index += 1;
      while (index + 1 < source.length && source[index + 1] !== '\n' && source[index + 1] !== '\r') {
        index += 1;
      }
      continue;
    }
    if (current === '/' && next === '*') {
      output += ' ';
      index += 1;
      while (index + 1 < source.length) {
        if (source[index] === '*' && source[index + 1] === '/') {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }
    output += current;
  }

  return output;
}

function normalizeSchemaSql(sql) {
  return stripSqlComments(sql).replace(/\s+/g, ' ').trim();
}

function schemaFingerprint(entries, classification = classifyTableEntries(entries)) {
  const excludedObjects = new Set([
    ...classification.shadowTables,
    ...classification.systemTables,
  ]);
  const normalized = entries
    .filter((entry) => entry.sql)
    .filter((entry) => !String(entry.name).startsWith('sqlite_autoindex_'))
    .filter((entry) => !excludedObjects.has(entry.name))
    .filter((entry) => !excludedObjects.has(entry.tbl_name))
    .map((entry) => [
      entry.type,
      entry.name,
      entry.tbl_name || '',
      normalizeSchemaSql(entry.sql),
    ].join(':'))
    .sort()
    .join('\n');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function listBackupTables(options) {
  const args = buildListTablesArgs(options);
  const stdout = runWrangler(args, { cwd: options.cwd });
  const entries = parseWranglerJson(stdout);
  const classification = classifyTableEntries(entries);
  return {
    entries,
    ...classification,
    schemaFingerprint: schemaFingerprint(entries, classification),
  };
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const database = String(cli.database || 'tohieuquiz-db');
  const config = String(cli.config || 'wrangler.toml');
  const mode = cli.remote ? 'remote' : 'local';
  const result = listBackupTables({
    database,
    config,
    mode,
    persistTo: cli['persist-to'] ? path.resolve(String(cli['persist-to'])) : undefined,
    confirmRemote: cli['confirm-remote'] ? String(cli['confirm-remote']) : undefined,
    cwd: path.resolve(__dirname, '..'),
  });
  process.stdout.write(`${JSON.stringify({
    database,
    mode,
    exportTables: result.exportTables,
    excluded: {
      virtualTables: result.virtualTables,
      shadowTables: result.shadowTables,
      systemTables: result.systemTables,
    },
    schemaFingerprint: result.schemaFingerprint,
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  MASTER_TABLE_QUERY,
  buildListTablesArgs,
  classifyTableEntries,
  listBackupTables,
  normalizeMode,
  normalizeSchemaSql,
  parseCliArgs,
  parseWranglerJson,
  runWrangler,
  schemaFingerprint,
  stripSqlComments,
};
