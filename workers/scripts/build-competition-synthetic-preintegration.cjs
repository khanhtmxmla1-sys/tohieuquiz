#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SENSITIVE_KEY = /(password|token|authorization|secret|credential|access.?code|answers?|raw.?body)/i;
const EXTERNAL_BLOCKERS = Object.freeze([
  'WP3_REPRESENTATIVE_D1_AND_ROLLBACK_EVIDENCE_MISSING',
  'WP4_REAL_QUEUE_R2_CERTIFICATE_EVIDENCE_MISSING',
  'WP5_CANDIDATE_CAPACITY_BENCHMARK_MISSING',
]);
const SECURITY_CASES = Object.freeze([
  'student_cross_read',
  'student_identity_override',
  'teacher_cross_class_read',
  'invigilator_publish',
  'invigilator_grant_retest',
  'unassigned_teacher_incident',
  'room_code_only_join',
  'raw_result_embargo',
  'blocking_reconcile_publish',
  'immutable_publication_edit',
  'export_scope_bypass',
]);

function containsSensitiveKeys(value) {
  if (Array.isArray(value)) return value.some(containsSensitiveKeys);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, item]) => (
    SENSITIVE_KEY.test(key) || containsSensitiveKeys(item)
  ));
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function classCode(index) {
  return String.fromCharCode(65 + index);
}

function validateOptions(options) {
  if (!/^[a-f0-9]{40}$/i.test(String(options.candidateSha || ''))) {
    throw new Error('candidateSha must be a 40-character git SHA.');
  }
  if (!Number.isInteger(options.studentCount) || options.studentCount < 100) {
    throw new Error('studentCount must be an integer greater than or equal to 100.');
  }
  if (!Number.isInteger(options.classCount) || options.classCount < 2 || options.classCount > 10) {
    throw new Error('classCount must be an integer from 2 to 10.');
  }
}

function buildSyntheticPreintegrationDataset({
  candidateSha,
  studentCount = 120,
  classCount = 4,
  generatedAt = new Date().toISOString(),
} = {}) {
  validateOptions({ candidateSha, studentCount, classCount });
  const classes = Array.from({ length: classCount }, (_, index) => ({
    id: `synthetic-class-4${classCode(index).toLowerCase()}`,
    name: `Synthetic 4${classCode(index)}`,
    gradeLevel: 4,
    ownerUsername: `synthetic-teacher-${String(index + 1).padStart(2, '0')}`,
    synthetic: true,
  }));
  const students = Array.from({ length: studentCount }, (_, index) => {
    const sequence = index + 1;
    const originalClass = classes[index % classes.length];
    return {
      id: `synthetic-student-${String(sequence).padStart(3, '0')}`,
      fullName: `Synthetic Student ${String(sequence).padStart(3, '0')}`,
      originalClassId: originalClass.id,
      gradeLevel: 4,
      synthetic: true,
    };
  });
  const rounds = Array.from({ length: 6 }, (_, index) => {
    const roundNumber = index + 1;
    return {
      id: `synthetic-round-${roundNumber}`,
      roundNumber,
      status: 'FINALIZED',
      maxAttempts: 2,
      passingScore: 70,
      progress: students.map((student, studentIndex) => ({
        studentId: student.id,
        originalClassId: student.originalClassId,
        attemptsUsed: 1 + ((studentIndex + roundNumber) % 2),
        bestScore: 70 + ((studentIndex * 7 + roundNumber * 3) % 31),
        isPassed: true,
      })),
    };
  });
  const eligibility = students.map((student, index) => ({
    studentId: student.id,
    originalClassId: student.originalClassId,
    qualified: index % 4 !== 3,
    reasonCodes: index % 4 !== 3 ? ['SIX_ROUNDS_COMPLETED'] : ['SYNTHETIC_NOT_SELECTED'],
  }));
  const qualified = eligibility.filter((item) => item.qualified);
  const rooms = classes.map((item, index) => ({
    id: `synthetic-room-${String(index + 1).padStart(2, '0')}`,
    originalClassId: item.id,
    scheduledAt: '2027-05-10T01:00:00.000Z',
    durationMinutes: 60,
    members: qualified
      .filter((student) => student.originalClassId === item.id)
      .map((student) => ({
        studentId: student.studentId,
        originalClassId: student.originalClassId,
        status: 'ASSIGNED',
      })),
  }));
  const publicationResults = qualified.map((student, index) => ({
    studentId: student.studentId,
    originalClassId: student.originalClassId,
    score: 100 - (index % 31),
    rankEvent: index + 1,
    publicationVersion: 1,
    rankingVersion: 1,
  }));
  const core = {
    classification: 'SYNTHETIC/LOCAL',
    productionEvidence: false,
    featureFlagRequired: false,
    candidateSha,
    status: 'LOCAL_PASS_EXTERNAL_BLOCKED',
    externalBlockers: [...EXTERNAL_BLOCKERS],
    counts: {
      classes: classes.length,
      students: students.length,
      rounds: rounds.length,
      roundProgressRows: rounds.reduce((total, round) => total + round.progress.length, 0),
      qualifiedStudents: qualified.length,
      rooms: rooms.length,
      publicationResults: publicationResults.length,
    },
    classes,
    students,
    campaign: {
      id: 'synthetic-campaign-competition-v1',
      status: 'PUBLISHED',
      audienceSnapshotVersion: 1,
      eligibilitySnapshotVersion: 1,
      rounds,
      eligibility,
    },
    schoolExam: {
      id: 'synthetic-school-exam-event',
      status: 'PUBLISHED',
      plannedConcurrency: qualified.length,
      rooms,
    },
    publication: {
      version: 1,
      rankingVersion: 1,
      results: publicationResults,
    },
    securityMatrix: SECURITY_CASES.map((id) => ({ id, expected: 'DENY' })),
    localCoverage: [
      'tests/competitionCampaignRoutes.worker.test.ts',
      'tests/competitionRoundEngine.worker.test.ts',
      'tests/competitionEligibility.worker.test.ts',
      'tests/competitionSchoolExamOrchestration.worker.test.ts',
      'tests/competitionSchoolExamEmbargo.worker.test.ts',
      'cypress/e2e/competition-v1.cy.ts',
    ],
  };
  if (containsSensitiveKeys(core)) throw new Error('Synthetic dataset contains a forbidden sensitive key.');
  return {
    ...core,
    generatedAt,
    datasetSha256: sha256Json(core),
  };
}

function isWithin(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function repositoryRoot() {
  return path.resolve(__dirname, '..', '..');
}

function currentSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot(), encoding: 'utf8' }).trim();
}

function parseCliArgs(argv) {
  const options = { candidateSha: null, output: null, studentCount: 120, classCount: 4 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--candidate-sha') options.candidateSha = argv[++index];
    else if (arg === '--students') options.studentCount = Number(argv[++index]);
    else if (arg === '--classes') options.classCount = Number(argv[++index]);
    else if (arg === '--output') options.output = argv[++index];
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function usage() {
  return 'Usage: node workers/scripts/build-competition-synthetic-preintegration.cjs [--candidate-sha <sha>] [--students 120] [--classes 4] [--output <outside-repo.json>]';
}

function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);
  if (options.help) {
    console.log(usage());
    return null;
  }
  const dataset = buildSyntheticPreintegrationDataset({
    candidateSha: options.candidateSha || currentSha(),
    studentCount: options.studentCount,
    classCount: options.classCount,
  });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quizpro-wp6-synthetic-'));
  const output = path.resolve(options.output || path.join(
    directory,
    `competition-synthetic-preintegration-${dataset.candidateSha}.json`,
  ));
  if (isWithin(output, repositoryRoot())) {
    throw new Error(`Synthetic evidence output must be outside the repository: ${output}`);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(dataset, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({
    status: dataset.status,
    classification: dataset.classification,
    candidateSha: dataset.candidateSha,
    datasetSha256: dataset.datasetSha256,
    counts: dataset.counts,
    externalBlockers: dataset.externalBlockers,
    evidencePath: output,
  }, null, 2));
  return dataset;
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
  EXTERNAL_BLOCKERS,
  SECURITY_CASES,
  buildSyntheticPreintegrationDataset,
  containsSensitiveKeys,
  parseCliArgs,
};
