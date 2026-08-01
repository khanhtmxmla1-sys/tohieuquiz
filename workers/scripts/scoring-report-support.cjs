#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { buildSync } = require('esbuild');
const {
  parseCliArgs,
  parseWranglerJson,
  runWrangler,
} = require('./list-backup-tables.cjs');

const DEFAULT_DATABASE = 'tohieuquiz-db';

function normalizeReadOnlyOptions(input = {}) {
  const cwd = path.resolve(String(input.cwd || path.resolve(__dirname, '..')));
  const database = String(input.database || DEFAULT_DATABASE);
  const config = String(input.config || 'wrangler.toml');
  const remote = input.remote === true || input.mode === 'remote';
  const local = input.local === true || input.mode === 'local';
  if (remote === local) throw new Error('Choose exactly one target: --local or --remote.');
  const mode = remote ? 'remote' : 'local';
  const confirmRemote = input['confirm-remote'] || input.confirmRemote;
  const persistTo = input['persist-to'] || input.persistTo;
  if (mode === 'remote' && String(confirmRemote || '') !== database) {
    throw new Error(`Remote D1 read requires --confirm-remote ${database}`);
  }
  if (mode === 'local' && !persistTo) {
    throw new Error('Local D1 read requires --persist-to for an isolated database state.');
  }
  if (input.write || input.execute || input.fix) {
    throw new Error('Scoring reports are read-only and do not accept write/fix flags.');
  }
  return {
    cwd,
    database,
    config,
    mode,
    persistTo: persistTo ? path.resolve(String(persistTo)) : undefined,
    reportsDir: path.resolve(String(input['reports-dir'] || input.reportsDir || path.join(cwd, '..', 'reports'))),
    limit: Math.min(50000, Math.max(1, Number(input.limit || 5000))),
  };
}

function targetArgs(options) {
  return options.mode === 'remote'
    ? ['--remote']
    : ['--local', '--persist-to', options.persistTo];
}

function queryD1(options, sql, runner = runWrangler) {
  if (!/^\s*SELECT\b/i.test(sql)) throw new Error('Only SELECT statements are allowed.');
  if (/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|REPLACE|PRAGMA)\b/i.test(sql)) {
    throw new Error('Mutating SQL is forbidden in scoring report scripts.');
  }
  const output = runner([
    'wrangler', 'd1', 'execute', options.database,
    '--config', options.config,
    '--command', sql,
    '--json',
    ...targetArgs(options),
  ], { cwd: options.cwd });
  return parseWranglerJson(output);
}

let cachedRuntime;
function loadScoringRuntime(repoRoot = path.resolve(__dirname, '..', '..')) {
  if (cachedRuntime) return cachedRuntime;
  const result = buildSync({
    stdin: {
      contents: [
        'export * from "./src/domain/quiz-scoring/index.ts";',
        'export { mapLiveExamQuestionRow } from "./workers/src/services/liveExamQuestionMapper.ts";',
      ].join('\n'),
      resolveDir: repoRoot,
      sourcefile: 'scoring-report-runtime.ts',
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    write: false,
    sourcemap: false,
    logLevel: 'silent',
  });
  const compiled = result.outputFiles[0].text;
  const runtimeModule = new Module(path.join(repoRoot, '.scoring-report-runtime.cjs'), module);
  runtimeModule.filename = path.join(repoRoot, '.scoring-report-runtime.cjs');
  runtimeModule.paths = module.paths;
  runtimeModule._compile(compiled, runtimeModule.filename);
  cachedRuntime = runtimeModule.exports;
  return cachedRuntime;
}

function parseStoredJson(value) {
  if (value === undefined || value === null || value === '') return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return value;
  return JSON.parse(trimmed);
}

function malformedJsonFields(row) {
  const fields = ['options', 'items', 'blanks', 'distractors', 'words', 'correct_word_indexes'];
  return fields.filter((field) => {
    const value = row[field];
    if (typeof value !== 'string' || !value.trim()) return false;
    const trimmed = value.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return false;
    try {
      JSON.parse(trimmed);
      return false;
    } catch {
      return true;
    }
  });
}

function writeReports(prefix, report, reportsDir) {
  fs.mkdirSync(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, `${prefix}.json`);
  const markdownPath = path.join(reportsDir, `${prefix}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    `# ${report.title}`,
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
  ];
  for (const [key, value] of Object.entries(report.summary || {})) {
    lines.push(`- **${key}:** ${typeof value === 'object' ? JSON.stringify(value) : value}`);
  }
  if (Array.isArray(report.issues) && report.issues.length > 0) {
    lines.push('', '## Issues', '', '| Quiz | Question/Result | Type/Status | Code |', '|---|---|---|---|');
    for (const issue of report.issues.slice(0, 500)) {
      lines.push(`| ${issue.quizId || ''} | ${issue.questionId || issue.resultId || ''} | ${issue.type || issue.status || ''} | ${issue.code || ''} |`);
    }
  }
  fs.writeFileSync(markdownPath, `${lines.join('\n')}\n`);
  return { jsonPath, markdownPath };
}

module.exports = {
  loadScoringRuntime,
  malformedJsonFields,
  normalizeReadOnlyOptions,
  parseCliArgs,
  parseStoredJson,
  queryD1,
  writeReports,
};
