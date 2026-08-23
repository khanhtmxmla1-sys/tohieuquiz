#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const {
  findLocalD1File,
  serializeSqlValue,
} = require('./export-d1-tablewise.cjs');
const { parseCliArgs } = require('./list-backup-tables.cjs');

const PROTECTED_TABLES = Object.freeze([
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

const SENSITIVE_COLUMNS = Object.freeze({
  teachers: [
    'username', 'password', 'full_name', 'class', 'disabled_by', 'disabled_reason',
    'password_changed_at', 'last_login_at', 'disabled_at', 'created_at', 'updated_at',
  ],
  classes: ['id', 'name', 'teacher_username', 'created_at', 'archived_at'],
  students: [
    'id', 'full_name', 'username', 'password_hash', 'class_id', 'parent_phone', 'avatar',
    'created_at', 'archived_at',
  ],
  quizzes: [
    'id', 'title', 'access_code', 'created_by', 'tags', 'parent_quiz_id', 'created_at', 'updated_at',
  ],
  results: [
    'student_id', 'assignment_id', 'class_id', 'student_name', 'class_name',
    'quiz_id', 'quiz_title', 'answers', 'analytics_json', 'submitted_at',
  ],
  live_exam_sessions: [
    'id', 'title', 'quiz_id', 'teacher_id', 'class_id', 'settings', 'access_code',
    'scheduled_at', 'started_at', 'ends_at', 'closed_at', 'paused_at', 'archived_at',
    'created_at', 'updated_at',
  ],
  live_exam_participants: [
    'id', 'live_exam_id', 'student_id', 'username', 'answers', 'warnings',
    'joined_at', 'started_at', 'submitted_at', 'individual_ends_at', 'created_at', 'updated_at',
  ],
  live_exam_activity: ['live_exam_id', 'student_id', 'last_activity'],
  live_exam_answer_snapshots: ['live_exam_id', 'student_id', 'answers', 'idempotency_key', 'updated_at'],
  live_exam_connection_events: ['id', 'live_exam_id', 'student_id', 'created_at'],
});

const FIXED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function isWithin(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertOutsideRepository(candidate, repositoryRoot) {
  if (isWithin(candidate, repositoryRoot)) {
    throw new Error(`Snapshot path must be outside the repository: ${candidate}`);
  }
}

function collectSensitiveValues(source) {
  const values = new Set();
  for (const [table, columns] of Object.entries(SENSITIVE_COLUMNS)) {
    for (const row of source[table] || []) {
      for (const column of columns) {
        const value = row[column];
        if (typeof value === 'string' && value.length >= 3) values.add(value);
      }
    }
  }
  return [...values].sort((left, right) => right.length - left.length);
}

function findSensitiveLeaks(anonymized, sensitiveValues) {
  const source = typeof anonymized === 'string'
    ? anonymized
    : JSON.stringify(Object.fromEntries(Object.entries(SENSITIVE_COLUMNS).map(([table, columns]) => [
      table,
      (anonymized[table] || []).map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))),
    ])));
  return [...new Set(sensitiveValues.filter((value) => source.includes(value)))];
}

function createMap(values, prefix) {
  const unique = [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))]
    .map(String)
    .sort();
  return new Map(unique.map((value, index) => [value, `${prefix}-${String(index + 1).padStart(4, '0')}`]));
}

function mapped(mapping, value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  return mapping.get(String(value)) ?? fallback;
}

function fixedIfPresent(value) {
  return value === null || value === undefined || value === '' ? null : FIXED_TIMESTAMP;
}

function anonymizeProtectedRows(source) {
  const teacherMap = createMap([
    ...(source.teachers || []).map((row) => row.username),
    ...(source.classes || []).map((row) => row.teacher_username),
    ...(source.quizzes || []).map((row) => row.created_by),
    ...(source.live_exam_sessions || []).map((row) => row.teacher_id),
  ], 'teacher');
  const classMap = createMap([
    ...(source.classes || []).map((row) => row.id),
    ...(source.students || []).map((row) => row.class_id),
    ...(source.results || []).map((row) => row.class_id),
    ...(source.live_exam_sessions || []).map((row) => row.class_id),
  ], 'class');
  const studentMap = createMap([
    ...(source.students || []).map((row) => row.id),
    ...(source.results || []).map((row) => row.student_id),
    ...(source.live_exam_participants || []).map((row) => row.student_id),
    ...(source.live_exam_activity || []).map((row) => row.student_id),
    ...(source.live_exam_answer_snapshots || []).map((row) => row.student_id),
    ...(source.live_exam_connection_events || []).map((row) => row.student_id),
  ], 'student');
  const quizMap = createMap([
    ...(source.quizzes || []).flatMap((row) => [row.id, row.parent_quiz_id]),
    ...(source.results || []).map((row) => row.quiz_id),
    ...(source.live_exam_sessions || []).map((row) => row.quiz_id),
  ], 'quiz');
  const examMap = createMap([
    ...(source.live_exam_sessions || []).map((row) => row.id),
    ...(source.live_exam_participants || []).map((row) => row.live_exam_id),
    ...(source.live_exam_activity || []).map((row) => row.live_exam_id),
    ...(source.live_exam_answer_snapshots || []).map((row) => row.live_exam_id),
    ...(source.live_exam_connection_events || []).map((row) => row.live_exam_id),
  ], 'exam');
  const participantMap = createMap((source.live_exam_participants || []).map((row) => row.id), 'participant');
  const eventMap = createMap((source.live_exam_connection_events || []).map((row) => row.id), 'connection');

  return {
    teachers: (source.teachers || []).map((row, index) => ({
      ...row,
      username: mapped(teacherMap, row.username),
      password: '$2b$12$ANONYMIZED.SNAPSHOT.VALUE',
      full_name: `Teacher ${index + 1}`,
      class: null,
      disabled_by: mapped(teacherMap, row.disabled_by),
      disabled_reason: null,
      password_changed_at: fixedIfPresent(row.password_changed_at),
      last_login_at: fixedIfPresent(row.last_login_at),
      disabled_at: fixedIfPresent(row.disabled_at),
      created_at: fixedIfPresent(row.created_at),
      updated_at: fixedIfPresent(row.updated_at),
    })),
    classes: (source.classes || []).map((row, index) => ({
      ...row,
      id: mapped(classMap, row.id),
      name: `Class ${index + 1}`,
      teacher_username: mapped(teacherMap, row.teacher_username),
      created_at: FIXED_TIMESTAMP,
      archived_at: fixedIfPresent(row.archived_at),
    })),
    students: (source.students || []).map((row, index) => ({
      ...row,
      id: mapped(studentMap, row.id),
      full_name: `Student ${index + 1}`,
      username: `learner-${String(index + 1).padStart(4, '0')}`,
      password_hash: '$2b$12$ANONYMIZED.SNAPSHOT.VALUE',
      class_id: mapped(classMap, row.class_id),
      parent_phone: null,
      avatar: null,
      coins: 0,
      created_at: FIXED_TIMESTAMP,
      archived_at: fixedIfPresent(row.archived_at),
    })),
    quizzes: (source.quizzes || []).map((row, index) => ({
      ...row,
      id: mapped(quizMap, row.id),
      title: `Quiz ${index + 1}`,
      access_code: null,
      created_by: mapped(teacherMap, row.created_by),
      tags: null,
      parent_quiz_id: mapped(quizMap, row.parent_quiz_id),
      created_at: FIXED_TIMESTAMP,
      updated_at: fixedIfPresent(row.updated_at),
    })),
    results: (source.results || []).map((row, index) => ({
      ...row,
      student_id: mapped(studentMap, row.student_id),
      assignment_id: null,
      class_id: mapped(classMap, row.class_id),
      student_name: `Student Result ${index + 1}`,
      class_name: row.class_id ? `Class Result ${index + 1}` : null,
      quiz_id: mapped(quizMap, row.quiz_id),
      quiz_title: row.quiz_id ? `Quiz Result ${index + 1}` : null,
      score: 0,
      correct_count: 0,
      time_taken: 0,
      submitted_at: FIXED_TIMESTAMP,
      answers: null,
      analytics_json: null,
    })),
    live_exam_sessions: (source.live_exam_sessions || []).map((row, index) => ({
      ...row,
      id: mapped(examMap, row.id),
      title: `Live Exam ${index + 1}`,
      quiz_id: mapped(quizMap, row.quiz_id),
      teacher_id: mapped(teacherMap, row.teacher_id),
      class_id: mapped(classMap, row.class_id),
      settings: '{}',
      access_code: `ANON-${String(index + 1).padStart(4, '0')}`,
      scheduled_at: fixedIfPresent(row.scheduled_at),
      started_at: fixedIfPresent(row.started_at),
      ends_at: fixedIfPresent(row.ends_at),
      closed_at: fixedIfPresent(row.closed_at),
      paused_at: fixedIfPresent(row.paused_at),
      total_paused_seconds: 0,
      archived_at: fixedIfPresent(row.archived_at),
      created_at: FIXED_TIMESTAMP,
      updated_at: FIXED_TIMESTAMP,
    })),
    live_exam_participants: (source.live_exam_participants || []).map((row, index) => ({
      ...row,
      id: mapped(participantMap, row.id),
      live_exam_id: mapped(examMap, row.live_exam_id),
      student_id: mapped(studentMap, row.student_id),
      username: `candidate-${String(index + 1).padStart(4, '0')}`,
      joined_at: FIXED_TIMESTAMP,
      started_at: fixedIfPresent(row.started_at),
      submitted_at: fixedIfPresent(row.submitted_at),
      individual_ends_at: fixedIfPresent(row.individual_ends_at),
      answers: null,
      score: 0,
      correct_count: 0,
      wrong_count: 0,
      rank: null,
      tab_switches: 0,
      warnings: null,
      created_at: FIXED_TIMESTAMP,
      updated_at: FIXED_TIMESTAMP,
    })),
    live_exam_activity: (source.live_exam_activity || []).map((row) => ({
      ...row,
      live_exam_id: mapped(examMap, row.live_exam_id),
      student_id: mapped(studentMap, row.student_id),
      current_question: 0,
      answered_count: 0,
      last_activity: FIXED_TIMESTAMP,
      is_online: 0,
    })),
    live_exam_answer_snapshots: (source.live_exam_answer_snapshots || []).map((row, index) => ({
      ...row,
      live_exam_id: mapped(examMap, row.live_exam_id),
      student_id: mapped(studentMap, row.student_id),
      attempt_version: 1,
      answers: '{}',
      idempotency_key: `snapshot-key-${String(index + 1).padStart(4, '0')}`,
      updated_at: FIXED_TIMESTAMP,
    })),
    live_exam_connection_events: (source.live_exam_connection_events || []).map((row) => ({
      ...row,
      id: mapped(eventMap, row.id),
      live_exam_id: mapped(examMap, row.live_exam_id),
      student_id: mapped(studentMap, row.student_id),
      attempt_version: row.attempt_version === null ? null : 1,
      created_at: FIXED_TIMESTAMP,
    })),
  };
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function readProtectedRows(database) {
  return Object.fromEntries(PROTECTED_TABLES.map((table) => {
    const columns = database.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all();
    const primary = columns.filter((column) => Number(column.pk) > 0)
      .sort((left, right) => Number(left.pk) - Number(right.pk))
      .map((column) => quoteIdentifier(column.name));
    const order = primary.length > 0 ? ` ORDER BY ${primary.join(', ')}` : '';
    return [table, database.prepare(`SELECT * FROM ${quoteIdentifier(table)}${order}`).all()];
  }));
}

function serializeRows(rowsByTable) {
  const statements = [];
  for (const table of PROTECTED_TABLES) {
    for (const row of rowsByTable[table] || []) {
      const columns = Object.keys(row);
      const names = columns.map(quoteIdentifier).join(', ');
      const values = columns.map((column) => serializeSqlValue(row[column])).join(', ');
      statements.push(`INSERT INTO ${quoteIdentifier(table)} (${names}) VALUES (${values});`);
    }
  }
  return statements.join('\n');
}

function sha256(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function buildAnonymizedSnapshot(options) {
  const repositoryRoot = path.resolve(options.repositoryRoot);
  const output = path.resolve(options.output);
  const persistTo = path.resolve(options.persistTo);
  assertOutsideRepository(output, repositoryRoot);
  assertOutsideRepository(persistTo, repositoryRoot);
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite snapshot: ${output}`);

  const database = new DatabaseSync(findLocalD1File(persistTo), { readOnly: true });
  let source;
  try {
    source = readProtectedRows(database);
  } finally {
    database.close();
  }
  const sensitiveValues = collectSensitiveValues(source);
  const anonymized = anonymizeProtectedRows(source);
  const payload = [
    fs.readFileSync(options.baseline, 'utf8').trimEnd(),
    '',
    'PRAGMA foreign_keys=OFF;',
    serializeRows(anonymized),
    'PRAGMA foreign_keys=ON;',
    '',
  ].join('\n');
  const leaks = findSensitiveLeaks(anonymized, sensitiveValues);
  if (leaks.length > 0) {
    throw new Error(`Sensitive values remain in representative snapshot (${leaks.length}).`);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
  fs.writeFileSync(output, payload, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return {
    output,
    sha256: sha256(payload),
    tables: Object.fromEntries(PROTECTED_TABLES.map((table) => [table, anonymized[table].length])),
    sensitiveValuesRemoved: sensitiveValues.length,
  };
}

function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const workersDir = path.resolve(__dirname, '..');
  const repositoryRoot = path.resolve(workersDir, '..');
  const persistTo = cli['persist-to'] ? path.resolve(String(cli['persist-to'])) : '';
  const baseline = cli.baseline ? path.resolve(String(cli.baseline)) : '';
  const output = cli.output ? path.resolve(String(cli.output)) : '';
  if (!persistTo || !baseline || !output) {
    throw new Error('--persist-to, --baseline, and --output are required.');
  }
  const report = buildAnonymizedSnapshot({ persistTo, baseline, output, repositoryRoot });
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
  PROTECTED_TABLES,
  anonymizeProtectedRows,
  assertOutsideRepository,
  buildAnonymizedSnapshot,
  collectSensitiveValues,
  findSensitiveLeaks,
  readProtectedRows,
  serializeRows,
};
