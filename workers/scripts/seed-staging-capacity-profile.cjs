#!/usr/bin/env node
'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');

const requireFromScript = createRequire(__filename);
const {
  parseCliArgs,
  parseWranglerJson,
  runWrangler,
} = requireFromScript('./list-backup-tables.cjs');
const { certifyCapacityReport } = requireFromScript('./certify-live-exam-capacity.cjs');

const STAGING_DATABASE_PATTERN = /^tohieuquiz-[a-z0-9-]*(?:stg|staging)[a-z0-9-]*$/i;
const PRODUCTION_MARKERS = [
  'tohieuquiz-db',
  'thtohieu.com',
  'thitong.site',
  'quiz-api.',
];
const REQUIRED_PROFILE_FIELDS = [
  'profileId',
  'benchmarkRunId',
  'buildSha',
  'runtimeConfigVersion',
  'pollingProfileVersion',
  'passedAt',
  'createdAt',
];

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function quoteSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function isGitSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value.trim());
}

function validateStagingSeedTarget({ database, confirmStaging, configText }) {
  const normalizedDatabase = String(database || '').trim();
  if (!normalizedDatabase) throw new Error('database is required.');
  if (String(confirmStaging || '').trim() !== normalizedDatabase) {
    throw new Error(`Staging seed requires --confirm-staging ${normalizedDatabase}.`);
  }
  if (!STAGING_DATABASE_PATTERN.test(normalizedDatabase)) {
    throw new Error('Capacity seed refuses non-staging database names.');
  }
  const source = String(configText || '');
  if (!/^\s*workers_dev\s*=\s*true\s*$/im.test(source)) {
    throw new Error('Capacity seed requires workers_dev = true in the staging config.');
  }
  if (!/^\s*ENVIRONMENT\s*=\s*["']staging["']\s*$/im.test(source)) {
    throw new Error('Capacity seed requires ENVIRONMENT = "staging" in the config.');
  }
  if (/^\s*routes?\s*=/im.test(source)) {
    throw new Error('Capacity seed refuses configs with custom routes.');
  }
  if (!new RegExp(`^\\s*database_name\\s*=\\s*["']${normalizedDatabase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\s*$`, 'im').test(source)) {
    throw new Error('Capacity seed database does not match the staging config.');
  }
  const lowerSource = source.toLowerCase();
  if (PRODUCTION_MARKERS.some((marker) => lowerSource.includes(marker))) {
    throw new Error('Capacity seed refuses a config containing production resource markers.');
  }
  return true;
}

function validateCandidateProfile(profile, candidateSha) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('Certified capacity profile must be an object.');
  }
  for (const field of REQUIRED_PROFILE_FIELDS) {
    if (!nonEmpty(profile[field])) throw new Error(`Certified capacity profile ${field} is required.`);
  }
  if (profile.status !== 'CERTIFIED') throw new Error('Certified capacity profile must have status=CERTIFIED.');
  if (!isGitSha(profile.buildSha)) throw new Error('Certified capacity profile build SHA is invalid.');
  if (!isGitSha(candidateSha)) throw new Error('candidate SHA must be a 40-character git SHA.');
  if (profile.buildSha.trim().toLowerCase() !== candidateSha.trim().toLowerCase()) {
    throw new Error('Certified capacity profile build SHA does not match the candidate SHA.');
  }
  if (!Number.isInteger(profile.certifiedConcurrentStudents) || profile.certifiedConcurrentStudents <= 0) {
    throw new Error('Certified capacity profile concurrency is invalid.');
  }
  if (!(Number.isFinite(profile.statusP95Ms) && profile.statusP95Ms >= 0 && profile.statusP95Ms < 500)) {
    throw new Error('Certified capacity profile statusP95Ms is invalid.');
  }
  if (!(Number.isFinite(profile.submitP95Ms) && profile.submitP95Ms >= 0 && profile.submitP95Ms < 2000)) {
    throw new Error('Certified capacity profile submitP95Ms is invalid.');
  }
  for (const field of ['lostAnswers', 'duplicateFailures', 'd1Overload', 'app5xx', 'networkErrors']) {
    if (profile[field] !== 0) throw new Error(`Certified capacity profile ${field} must equal 0.`);
  }
  return profile;
}

function buildCapacitySeedSql(profile) {
  return `INSERT OR IGNORE INTO live_exam_capacity_profiles (
  id, benchmark_run_id, build_sha, runtime_config_version, polling_profile_version,
  certified_concurrent_students, status_p95_ms, submit_p95_ms, lost_answers,
  duplicate_failures, d1_overload, app_5xx, network_errors, status, passed_at, created_at
) VALUES (
  ${quoteSqlLiteral(profile.profileId)},
  ${quoteSqlLiteral(profile.benchmarkRunId)},
  ${quoteSqlLiteral(profile.buildSha)},
  ${quoteSqlLiteral(profile.runtimeConfigVersion)},
  ${quoteSqlLiteral(profile.pollingProfileVersion)},
  ${Number(profile.certifiedConcurrentStudents)},
  ${Number(profile.statusP95Ms)},
  ${Number(profile.submitP95Ms)},
  0, 0, 0, 0, 0,
  'CERTIFIED',
  ${quoteSqlLiteral(profile.passedAt)},
  ${quoteSqlLiteral(profile.createdAt)}
);
SELECT id, benchmark_run_id, build_sha, status
FROM live_exam_capacity_profiles
WHERE benchmark_run_id = ${quoteSqlLiteral(profile.benchmarkRunId)};`;
}

function readCertifiedProfile(inputPath) {
  const input = JSON.parse(readFileSync(resolve(inputPath), 'utf8'));
  if (input && input.status === 'CERTIFIED' && input.profileId) return input;
  return certifyCapacityReport(input);
}

function seedCapacityProfile({ input, database, config, confirmStaging, candidateSha }, dependencies = {}) {
  const configText = readFileSync(resolve(config), 'utf8');
  validateStagingSeedTarget({ database, confirmStaging, configText });
  const profile = validateCandidateProfile(readCertifiedProfile(input), candidateSha);
  const runner = dependencies.runWrangler || runWrangler;
  const output = runner([
    'wrangler', 'd1', 'execute', database,
    '--config', resolve(config),
    '--command', buildCapacitySeedSql(profile),
    '--yes', '--json', '--remote',
  ], { cwd: resolve(__dirname, '..') });
  const persisted = parseWranglerJson(output).find((row) => row.benchmark_run_id === profile.benchmarkRunId);
  if (!persisted || persisted.status !== 'CERTIFIED' || persisted.build_sha !== profile.buildSha) {
    throw new Error('Capacity profile seed could not be verified in staging D1.');
  }
  return {
    database,
    profileId: persisted.id,
    benchmarkRunId: persisted.benchmark_run_id,
    status: persisted.status,
    buildSha: persisted.build_sha,
  };
}

if (require.main === module) {
  try {
    const cli = parseCliArgs(process.argv.slice(2));
    const result = seedCapacityProfile({
      input: cli.input,
      database: cli.database,
      config: cli.config,
      confirmStaging: cli['confirm-staging'],
      candidateSha: cli['candidate-sha'],
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  buildCapacitySeedSql,
  seedCapacityProfile,
  validateCandidateProfile,
  validateStagingSeedTarget,
};
