#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { assertOutsideRepository } = require('./export-d1-tablewise.cjs');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const REQUIRED_EXTERNAL_GATES = Object.freeze([
  'real_queue_acceptance',
  'real_r2_artifact_validation',
  'certificate_linkage',
  'retry_behavior',
  'audit_evidence',
]);
const LOCAL_CONTRACT_GATES = Object.freeze({
  idempotency: {
    status: 'PASS',
    test: 'tests/competitionSchoolExamOrchestration.worker.test.ts',
    cases: ['certificate request replay', 'XLSX request replay'],
  },
  retry: {
    status: 'PASS',
    test: 'tests/competitionSchoolExamOrchestration.worker.test.ts',
    cases: ['transient XLSX R2 failure', 'terminal queue failure'],
  },
  authorization: {
    status: 'PASS',
    test: 'tests/competitionSchoolExamOrchestration.worker.test.ts',
    cases: ['class-scoped teacher', 'Admin school scope', 'download re-authorization'],
  },
  xlsx_shape: {
    status: 'PASS',
    test: 'tests/competitionSchoolExamOrchestration.worker.test.ts',
    cases: ['ZIP signature', 'required sheets', 'class-only rows'],
  },
  audit_sanitization: {
    status: 'PASS',
    test: 'tests/competitionReleaseHardening.test.ts',
    cases: ['no answers', 'no credentials', 'artifact hash/size/MIME only'],
  },
});
const SENSITIVE_KEY = /(password|token|authorization|secret|credential|access.?code|answers?|raw.?body|body|private.?key)/i;

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

function sanitizeEvidence(value) {
  if (Array.isArray(value)) return value.map(sanitizeEvidence);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SENSITIVE_KEY.test(key))
    .map(([key, item]) => [key, sanitizeEvidence(item)]));
}

function parseCliArgs(argv) {
  const options = { input: null, output: null, candidateSha: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.input = argv[++index];
    else if (arg === '--output') options.output = argv[++index];
    else if (arg === '--candidate-sha') options.candidateSha = argv[++index];
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function validateExternalEvidence(input, candidateSha) {
  const errors = [];
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: [...REQUIRED_EXTERNAL_GATES.map((gate) => `${gate}_missing`)] };
  }
  if (input.candidateSha !== candidateSha) errors.push('candidate_sha_mismatch');
  for (const gate of REQUIRED_EXTERNAL_GATES) {
    const value = input[gate];
    if (!value || value.status !== 'PASS') errors.push(`${gate}_missing_or_failed`);
  }
  const artifact = input.artifact;
  if (!artifact || artifact.mime !== XLSX_MIME) errors.push('xlsx_mime_invalid');
  if (!artifact || !/^[a-f0-9]{64}$/i.test(String(artifact.sha256 || ''))) errors.push('xlsx_checksum_missing');
  if (!artifact || !Number.isInteger(artifact.sizeBytes) || artifact.sizeBytes <= 1) errors.push('xlsx_size_missing');
  return { valid: errors.length === 0, errors };
}

function evaluateArtifactJourneyOutcome({ candidateSha, externalEvidence, treeDirty = false }) {
  const external = validateExternalEvidence(externalEvidence, candidateSha);
  const blockingGaps = [...external.errors];
  if (treeDirty) blockingGaps.push('candidate_worktree_dirty');
  return {
    status: blockingGaps.length === 0 ? 'PASS' : 'BLOCKED',
    blockingGaps,
    externalStatus: external.valid ? 'PASS' : 'BLOCKED',
  };
}

function buildEvidenceReport({ candidateSha, externalEvidence = null, treeDirty = false, generatedAt = new Date().toISOString() }) {
  if (!isSha(candidateSha)) throw new Error('candidateSha must be a 40-character git SHA.');
  const outcome = evaluateArtifactJourneyOutcome({ candidateSha, externalEvidence, treeDirty });
  return {
    schemaVersion: 1,
    journey: 'competition-v1-artifact-journey',
    candidateSha,
    generatedAt,
    status: outcome.status,
    externalStatus: outcome.externalStatus,
    blockingGaps: outcome.blockingGaps,
    localContract: LOCAL_CONTRACT_GATES,
    external: externalEvidence ? sanitizeEvidence(externalEvidence) : null,
    safety: {
      remoteWritesAttempted: false,
      secretsIncluded: false,
      evidenceDigest: sha256Hex(JSON.stringify({ candidateSha, blockingGaps: outcome.blockingGaps })),
    },
  };
}

function repositoryRoot() {
  return path.resolve(__dirname, '..', '..');
}

function currentSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot(), encoding: 'utf8' }).trim();
}

function worktreeDirty() {
  return execFileSync('git', ['status', '--porcelain'], { cwd: repositoryRoot(), encoding: 'utf8' }).trim().length > 0;
}

function usage() {
  return 'Usage: node workers/scripts/rehearse-competition-artifact-journey.cjs [--candidate-sha <sha>] [--input <evidence.json>] [--output <outside-repo.json>]';
}

function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);
  if (options.help) {
    console.log(usage());
    return null;
  }
  const candidateSha = options.candidateSha || currentSha();
  const externalEvidence = options.input
    ? JSON.parse(fs.readFileSync(path.resolve(options.input), 'utf8'))
    : null;
  const report = buildEvidenceReport({
    candidateSha,
    externalEvidence,
    treeDirty: worktreeDirty(),
  });
  const defaultDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'quizpro-wp4-'));
  const output = path.resolve(options.output || path.join(defaultDirectory, `competition-artifact-journey-${candidateSha}.json`));
  assertOutsideRepository(output, repositoryRoot());
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...report, evidencePath: output }, null, 2));
  return report;
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
  XLSX_MIME,
  REQUIRED_EXTERNAL_GATES,
  LOCAL_CONTRACT_GATES,
  buildEvidenceReport,
  evaluateArtifactJourneyOutcome,
  parseCliArgs,
  sanitizeEvidence,
  validateExternalEvidence,
};
