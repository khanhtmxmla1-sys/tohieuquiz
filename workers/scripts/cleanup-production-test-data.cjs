#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  parseCliArgs,
  parseWranglerJson,
  runWrangler,
} = require('./list-backup-tables.cjs');

const CLEANUP_CONFIRMATION = 'task38-test-fixtures';
const AUDIT_ID = 'audit-task38-production-test-cleanup-v1';
const PRODUCTION_DATABASE_ID = '527fd53b-b69c-4373-9512-b0f23a96c42d';
const FIXTURES = Object.freeze({
  teacher: Object.freeze({ username: 'test.gv1', role: 'teacher' }),
  students: Object.freeze([
    Object.freeze({ id: 's-9df31170', username: 'test.hs1' }),
    Object.freeze({ id: 's-c1e80cb7', username: 'test.hs2' }),
  ]),
  oldClass: Object.freeze({
    id: 'c-cd364c7d',
    name: 'Lớp Test 1',
    teacherUsername: 'test.gv1',
  }),
  preservedStudents: Object.freeze([
    Object.freeze({ id: 's-ca79f38f', username: 'smoke.student' }),
    Object.freeze({ id: 's-e4ba05c6', username: 'thienkhanh' }),
  ]),
  smokeTeacher: 'smoke.teacher',
  smokeClass: Object.freeze({
    id: 'c-production-smoke',
    name: 'Lớp Smoke Production',
    teacherUsername: 'smoke.teacher',
  }),
  protectedOwners: Object.freeze([
    'admin',
    'smoke.admin',
    'tongminhkhanh',
    'viethong',
  ]),
  knownQuizIds: Object.freeze(['q-test-gd5-toan']),
  knownCertificateBatchIds: Object.freeze([
    'batch-841f94f2-d6c7-4d92-bbff-035a3cbf0de1',
  ]),
  knownR2Keys: Object.freeze([
    'certs/cert-e8e31f31-a5a1-4cf5-94d9-b5917b4d9375.png',
    'certs/cert-f87c2d6f-ceb8-49cd-b6aa-be89a1aafe75.png',
  ]),
});

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
  const remote = input.mode === 'remote' || readBareFlag(input, 'remote');
  const local = input.mode === 'local' || readBareFlag(input, 'local');
  if (remote === local) {
    throw new Error('Choose exactly one D1 target mode: --local or --remote.');
  }

  const mode = remote ? 'remote' : 'local';
  const confirmRemote = input.confirmRemote || input['confirm-remote'];
  const confirmCleanup = input.confirmCleanup || input['confirm-cleanup'];
  const persistTo = input.persistTo || input['persist-to'];
  const reportPath = input.report || input['report-path'];
  const write = readBareFlag(input, 'write');

  if (persistTo === true) throw new Error('--persist-to requires a value.');
  if (reportPath === true) throw new Error('--report requires a value.');
  if (mode === 'remote' && confirmRemote !== database) {
    throw new Error(`Remote D1 access requires --confirm-remote ${database}`);
  }
  if (mode === 'local' && !persistTo) {
    throw new Error('Local D1 access requires --persist-to for an isolated database state.');
  }
  if (write && confirmCleanup !== CLEANUP_CONFIRMATION) {
    throw new Error(`Cleanup writes require --confirm-cleanup ${CLEANUP_CONFIRMATION}`);
  }

  return {
    database,
    config,
    cwd,
    mode,
    write,
    confirmRemote: confirmRemote ? String(confirmRemote) : undefined,
    confirmCleanup: confirmCleanup ? String(confirmCleanup) : undefined,
    persistTo: persistTo ? path.resolve(String(persistTo)) : undefined,
    reportPath: reportPath ? path.resolve(String(reportPath)) : undefined,
    r2Bucket: String(input.r2Bucket || input['r2-bucket'] || 'tohieuquiz-certificates'),
  };
}

function buildTargetArgs(options) {
  if (options.mode === 'remote') return ['--remote'];
  return ['--local', '--persist-to', options.persistTo];
}

function buildQueryArgs(options, sql) {
  return [
    'wrangler',
    'd1',
    'execute',
    options.database,
    '--config',
    options.config,
    '--command',
    sql,
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

function inList(values) {
  return values.map(quoteSqlLiteral).join(', ');
}

function buildRootPredicates() {
  const studentIds = FIXTURES.students.map((entry) => entry.id);
  const studentUsernames = FIXTURES.students.map((entry) => entry.username);
  const knownQuizIds = FIXTURES.knownQuizIds;
  return {
    studentIds: inList(studentIds),
    studentUsernames: inList(studentUsernames),
    knownQuizIds: inList(knownQuizIds),
    targetTeacher: quoteSqlLiteral(FIXTURES.teacher.username),
    oldClassId: quoteSqlLiteral(FIXTURES.oldClass.id),
    oldClassName: quoteSqlLiteral(FIXTURES.oldClass.name),
  };
}

function buildSnapshotQuery() {
  const p = buildRootPredicates();
  const preservedUsernames = inList(FIXTURES.preservedStudents.map((entry) => entry.username));
  const protectedOwners = inList(FIXTURES.protectedOwners);
  const knownBatchIds = inList(FIXTURES.knownCertificateBatchIds);
  return [
    `SELECT 'targetTeacher' AS bucket, username, role FROM teachers WHERE username=${p.targetTeacher}`,
    `SELECT 'targetStudents' AS bucket, id, username, class_id FROM students WHERE username IN (${p.studentUsernames}) ORDER BY username`,
    `SELECT 'targetClass' AS bucket, id, name, teacher_username FROM classes WHERE id=${p.oldClassId} OR name=${p.oldClassName}`,
    `SELECT 'preservedStudents' AS bucket, id, username, class_id, archived_at FROM students WHERE username IN (${preservedUsernames}) ORDER BY username`,
    `SELECT 'classOccupants' AS bucket, id, username, class_id FROM students WHERE class_id=${p.oldClassId} ORDER BY username`,
    `SELECT 'smokeTeacher' AS bucket, username, role, class, status FROM teachers WHERE username=${quoteSqlLiteral(FIXTURES.smokeTeacher)}`,
    `SELECT 'protectedOwners' AS bucket, username FROM teachers WHERE username IN (${protectedOwners}) ORDER BY username`,
    `SELECT 'smokeClass' AS bucket, id, name, teacher_username, archived_at FROM classes WHERE id=${quoteSqlLiteral(FIXTURES.smokeClass.id)} OR name=${quoteSqlLiteral(FIXTURES.smokeClass.name)}`,
    `SELECT 'artifactCounts' AS bucket, 'quizzes' AS table_name, COUNT(*) AS row_count FROM quizzes WHERE created_by=${p.targetTeacher} OR id IN (${p.knownQuizIds})`,
    `SELECT 'artifactCounts' AS bucket, 'assignments' AS table_name, COUNT(*) AS row_count FROM assignments WHERE class_id=${p.oldClassId} OR student_id IN (${p.studentIds}) OR quiz_id IN (SELECT id FROM quizzes WHERE created_by=${p.targetTeacher} OR id IN (${p.knownQuizIds}))`,
    `SELECT 'artifactCounts' AS bucket, 'results' AS table_name, COUNT(*) AS row_count FROM results WHERE student_id IN (${p.studentIds}) OR class_name=${p.oldClassName} OR quiz_id IN (SELECT id FROM quizzes WHERE created_by=${p.targetTeacher} OR id IN (${p.knownQuizIds}))`,
    `SELECT 'artifactCounts' AS bucket, 'certificate_batches' AS table_name, COUNT(*) AS row_count FROM certificate_batches WHERE teacher_id=${p.targetTeacher} OR class_id=${p.oldClassId} OR id IN (${knownBatchIds})`,
    `SELECT 'artifactCounts' AS bucket, 'certificates' AS table_name, COUNT(*) AS row_count FROM certificates WHERE student_id IN (${p.studentIds}) OR batch_id IN (SELECT id FROM certificate_batches WHERE teacher_id=${p.targetTeacher} OR class_id=${p.oldClassId} OR id IN (${knownBatchIds}))`,
    `SELECT 'artifactCounts' AS bucket, 'live_exam_sessions' AS table_name, COUNT(*) AS row_count FROM live_exam_sessions WHERE teacher_id=${p.targetTeacher} OR class_id=${p.oldClassId} OR quiz_id IN (SELECT id FROM quizzes WHERE created_by=${p.targetTeacher} OR id IN (${p.knownQuizIds}))`,
    `SELECT 'artifactCounts' AS bucket, 'phieu_nhanxet' AS table_name, COUNT(*) AS row_count FROM phieu_nhanxet WHERE student_id IN (${p.studentIds}) OR class_id=${p.oldClassId} OR created_by=${p.targetTeacher}`,
    `SELECT 'artifactCounts' AS bucket, 'phieu_batch' AS table_name, COUNT(*) AS row_count FROM phieu_batch WHERE teacher_id=${p.targetTeacher} OR class_id=${p.oldClassId}`,
    `SELECT 'artifactCounts' AS bucket, 'notifications' AS table_name, COUNT(*) AS row_count FROM notifications WHERE user_id IN (${p.studentIds}, ${p.studentUsernames}, ${p.targetTeacher}) OR instr(data, 'q-test-gd5-toan') > 0`,
    `SELECT 'artifactCounts' AS bucket, 'parent_notifications' AS table_name, COUNT(*) AS row_count FROM parent_notifications WHERE student_id IN (${p.studentIds}) OR (source_type='result' AND source_id IN (SELECT CAST(id AS TEXT) FROM results WHERE class_name=${p.oldClassName} OR quiz_id IN (SELECT id FROM quizzes WHERE created_by=${p.targetTeacher} OR id IN (${p.knownQuizIds}))))`,
  ].join(';\n') + ';';
}

function groupSnapshotRows(rows) {
  const snapshot = {
    targetTeacher: [],
    targetStudents: [],
    targetClass: [],
    preservedStudents: [],
    classOccupants: [],
    smokeTeacher: [],
    protectedOwners: [],
    smokeClass: [],
    artifactCounts: [],
  };
  for (const row of rows) {
    if (Object.hasOwn(snapshot, row.bucket)) snapshot[row.bucket].push(row);
  }
  return snapshot;
}

function sameSet(actual, expected) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateSnapshot(input) {
  const snapshot = {
    targetTeacher: input.targetTeacher || [],
    targetStudents: input.targetStudents || [],
    targetClass: input.targetClass || [],
    preservedStudents: input.preservedStudents || [],
    classOccupants: input.classOccupants || [
      ...(input.targetStudents || []),
      ...(input.preservedStudents || []),
    ],
    smokeTeacher: input.smokeTeacher || [],
    protectedOwners: input.protectedOwners || [],
    smokeClass: input.smokeClass || [],
    artifactCounts: input.artifactCounts || [],
  };

  const smokeTeacher = snapshot.smokeTeacher.find((row) => row.username === FIXTURES.smokeTeacher);
  if (!smokeTeacher || smokeTeacher.role !== 'teacher' || smokeTeacher.status !== 'ACTIVE') {
    throw new Error('Required smoke.teacher account is missing or has the wrong role.');
  }
  const ownerNames = snapshot.protectedOwners.map((row) => row.username);
  for (const owner of FIXTURES.protectedOwners) {
    if (!ownerNames.includes(owner)) throw new Error(`Protected owner is missing: ${owner}`);
  }
  const preservedNames = snapshot.preservedStudents.map((row) => row.username);
  const expectedPreserved = FIXTURES.preservedStudents.map((row) => row.username);
  if (!sameSet(preservedNames, expectedPreserved)) {
    throw new Error(`Unexpected class occupant set: expected only ${expectedPreserved.join(', ')} outside the deletion targets.`);
  }
  for (const expected of FIXTURES.preservedStudents) {
    const row = snapshot.preservedStudents.find((entry) => entry.username === expected.username);
    if (!row || row.id !== expected.id) {
      throw new Error(`Preserved student identity mismatch: ${expected.username}`);
    }
  }

  const smokeStudent = snapshot.preservedStudents.find((row) => row.username === 'smoke.student');
  if (smokeStudent?.archived_at) {
    throw new Error('Dedicated smoke.student fixture is archived.');
  }

  const targetCounts = [
    snapshot.targetTeacher.length,
    snapshot.targetStudents.length,
    snapshot.targetClass.length,
  ];
  const fullyPresent = targetCounts[0] === 1 && targetCounts[1] === FIXTURES.students.length && targetCounts[2] === 1;
  const fullyAbsent = targetCounts.every((count) => count === 0);
  if (!fullyPresent && !fullyAbsent) {
    throw new Error('Cleanup target state is partial; restore or investigate before continuing.');
  }

  if (fullyPresent) {
    const teacher = snapshot.targetTeacher[0];
    if (teacher.username !== FIXTURES.teacher.username || teacher.role !== FIXTURES.teacher.role) {
      throw new Error('Target teacher identity does not match the approved fixture.');
    }
    const classRow = snapshot.targetClass[0];
    if (
      classRow.id !== FIXTURES.oldClass.id
      || classRow.name !== FIXTURES.oldClass.name
      || classRow.teacher_username !== FIXTURES.oldClass.teacherUsername
    ) {
      throw new Error('Target class identity does not match the approved fixture.');
    }
    const studentNames = snapshot.targetStudents.map((row) => row.username);
    if (!sameSet(studentNames, FIXTURES.students.map((row) => row.username))) {
      throw new Error('Target student identities do not match the approved fixtures.');
    }
    for (const expected of FIXTURES.students) {
      const row = snapshot.targetStudents.find((entry) => entry.username === expected.username);
      if (!row || row.id !== expected.id || row.class_id !== FIXTURES.oldClass.id) {
        throw new Error(`Target student identity mismatch: ${expected.username}`);
      }
    }
    const expectedOccupants = [
      ...FIXTURES.students.map((row) => row.username),
      ...expectedPreserved,
    ];
    const actualOccupants = snapshot.classOccupants.map((row) => row.username);
    if (!sameSet(actualOccupants, expectedOccupants)) {
      throw new Error(`Unexpected class occupant detected in ${FIXTURES.oldClass.name}.`);
    }
    for (const row of snapshot.preservedStudents) {
      if (row.class_id !== FIXTURES.oldClass.id) {
        throw new Error(`Preserved student is not in the expected source class: ${row.username}`);
      }
    }
    return { state: 'ready', snapshot };
  }

  if (snapshot.classOccupants.length !== 0) {
    throw new Error('Old class is absent but still has occupants; investigate the partial cleanup.');
  }
  const smokeClass = snapshot.smokeClass.find((row) => row.id === FIXTURES.smokeClass.id);
  if (
    !smokeClass
    || smokeClass.name !== FIXTURES.smokeClass.name
    || smokeClass.teacher_username !== FIXTURES.smokeClass.teacherUsername
  ) {
    throw new Error('Dedicated production smoke class is missing after cleanup.');
  }
  if (smokeClass.archived_at) {
    throw new Error('Dedicated production smoke class is archived.');
  }
  for (const row of snapshot.preservedStudents) {
    if (row.class_id !== FIXTURES.smokeClass.id) {
      throw new Error(`Preserved student was not moved to the smoke class: ${row.username}`);
    }
  }
  return { state: 'up-to-date', snapshot };
}

function buildCleanupSql({ requestId, now }) {
  const p = buildRootPredicates();
  const targetStudentIds = p.studentIds;
  const targetStudentUsernames = p.studentUsernames;
  const preservedConditions = FIXTURES.preservedStudents
    .map((entry) => `(id=${quoteSqlLiteral(entry.id)} AND username=${quoteSqlLiteral(entry.username)})`)
    .join(' OR ');
  const knownBatchIds = inList(FIXTURES.knownCertificateBatchIds);
  const targetQuiz = `(SELECT id FROM quizzes WHERE created_by=${p.targetTeacher} OR id IN (${p.knownQuizIds}))`;
  const targetAssignments = `(SELECT id FROM assignments WHERE class_id=${p.oldClassId} OR student_id IN (${targetStudentIds}) OR quiz_id IN ${targetQuiz})`;
  const targetResults = `(SELECT id FROM results WHERE student_id IN (${targetStudentIds}) OR class_name=${p.oldClassName} OR assignment_id IN ${targetAssignments} OR quiz_id IN ${targetQuiz})`;
  const targetLiveExams = `(SELECT id FROM live_exam_sessions WHERE teacher_id=${p.targetTeacher} OR class_id=${p.oldClassId} OR quiz_id IN ${targetQuiz})`;
  const targetParticipants = `(SELECT id FROM live_exam_participants WHERE live_exam_id IN ${targetLiveExams} OR student_id IN (${targetStudentIds}))`;
  const targetBatches = `(SELECT id FROM certificate_batches WHERE teacher_id=${p.targetTeacher} OR class_id=${p.oldClassId} OR quiz_id IN ${targetQuiz} OR id IN (${knownBatchIds}))`;
  const targetCertificates = `(SELECT id FROM certificates WHERE batch_id IN ${targetBatches} OR student_id IN (${targetStudentIds}))`;
  const targetPhieu = `(SELECT id FROM phieu_nhanxet WHERE student_id IN (${targetStudentIds}) OR class_id=${p.oldClassId} OR created_by=${p.targetTeacher} OR submission_id IN (SELECT 'result:' || CAST(id AS TEXT) FROM results WHERE id IN ${targetResults}))`;
  const targetPhieuBatches = `(SELECT id FROM phieu_batch WHERE class_id=${p.oldClassId} OR teacher_id=${p.targetTeacher} OR quiz_id IN ${targetQuiz} OR assignment_id IN ${targetAssignments} OR assignment_id IN (SELECT 'result:' || CAST(id AS TEXT) FROM results WHERE id IN ${targetResults}))`;
  const targetParentLinks = `(SELECT id FROM parent_links WHERE student_id IN (${targetStudentIds}))`;
  const targetGiftOrders = `(SELECT id FROM gift_orders WHERE student_id IN (${targetStudentIds}) OR class_id=${p.oldClassId})`;
  const targetHwAssignments = `(SELECT id FROM hw_assignments WHERE teacher_id=${p.targetTeacher} OR class_id=${p.oldClassId})`;
  const targetGroups = `(SELECT id FROM intervention_groups WHERE teacher_username=${p.targetTeacher} OR class_id=${p.oldClassId})`;
  const beforeJson = quoteSqlLiteral(JSON.stringify({
    fixtures: ['test.gv1', 'test.hs1', 'test.hs2', 'Lớp Test 1'],
    preserved: ['smoke.student', 'thienkhanh'],
  }));
  const afterJson = quoteSqlLiteral(JSON.stringify({
    smokeClass: FIXTURES.smokeClass.name,
    r2Keys: FIXTURES.knownR2Keys.length,
  }));

  return [
    'PRAGMA foreign_keys=ON;',
    'BEGIN IMMEDIATE;',
    `INSERT INTO classes (id, name, teacher_username, created_at, archived_at) VALUES (${quoteSqlLiteral(FIXTURES.smokeClass.id)}, ${quoteSqlLiteral(FIXTURES.smokeClass.name)}, ${quoteSqlLiteral(FIXTURES.smokeClass.teacherUsername)}, ${quoteSqlLiteral(now)}, NULL) ON CONFLICT(id) DO UPDATE SET name=excluded.name, teacher_username=excluded.teacher_username, archived_at=NULL;`,
    `UPDATE students SET class_id=${quoteSqlLiteral(FIXTURES.smokeClass.id)} WHERE ${preservedConditions};`,
    `UPDATE teachers SET class=${quoteSqlLiteral(FIXTURES.smokeClass.name)}, updated_at=${quoteSqlLiteral(now)} WHERE username=${quoteSqlLiteral(FIXTURES.smokeTeacher)} AND role='teacher';`,

    `DELETE FROM result_report_delivery_items WHERE batch_id IN ${targetPhieuBatches} OR result_id IN (SELECT CAST(id AS TEXT) FROM results WHERE id IN ${targetResults}) OR phieu_id IN ${targetPhieu} OR student_id IN (${targetStudentIds});`,
    `DELETE FROM phieu_public_links WHERE batch_id IN ${targetPhieuBatches} OR phieu_id IN ${targetPhieu};`,
    `DELETE FROM phieu_batch_items WHERE batch_id IN ${targetPhieuBatches} OR phieu_id IN ${targetPhieu};`,
    `DELETE FROM phieu_batch WHERE id IN ${targetPhieuBatches};`,
    `DELETE FROM phieu_nhanxet WHERE id IN ${targetPhieu};`,

    `DELETE FROM parent_contact_tokens WHERE link_id IN ${targetParentLinks};`,
    `DELETE FROM parent_contact_preferences WHERE link_id IN ${targetParentLinks};`,
    `DELETE FROM parent_digest_runs WHERE link_id IN ${targetParentLinks} OR student_id IN (${targetStudentIds});`,
    `DELETE FROM parent_activation_tokens WHERE link_id IN ${targetParentLinks};`,
    `UPDATE parent_account_audit SET link_id=NULL WHERE link_id IN ${targetParentLinks};`,
    `DELETE FROM parent_notifications WHERE student_id IN (${targetStudentIds}) OR (source_type='result' AND source_id IN (SELECT CAST(id AS TEXT) FROM results WHERE id IN ${targetResults})) OR (source_type='certificate' AND source_id IN (SELECT id FROM certificates WHERE id IN ${targetCertificates}));`,
    `DELETE FROM parent_links WHERE id IN ${targetParentLinks};`,
    `DELETE FROM parent_class_announcements WHERE class_id=${p.oldClassId} OR created_by=${p.targetTeacher};`,

    `DELETE FROM notifications WHERE user_id IN (${targetStudentIds}, ${targetStudentUsernames}, ${p.targetTeacher}) OR source_id IN (SELECT CAST(id AS TEXT) FROM results WHERE id IN ${targetResults}) OR source_id IN (SELECT id FROM certificates WHERE id IN ${targetCertificates}) OR instr(data, 'q-test-gd5-toan') > 0 OR instr(data, 'a-89e6d829') > 0 OR instr(data, 'a-ad428659') > 0;`,
    `DELETE FROM notification_preferences WHERE user_id IN (${targetStudentIds}, ${targetStudentUsernames}, ${p.targetTeacher});`,

    `DELETE FROM certificates WHERE id IN ${targetCertificates};`,
    `DELETE FROM certificate_batches WHERE id IN ${targetBatches};`,
    `DELETE FROM certificate_templates WHERE created_by=${p.targetTeacher};`,

    `DELETE FROM live_exam_student_timing WHERE session_id IN ${targetLiveExams} OR participant_id IN ${targetParticipants};`,
    `DELETE FROM live_exam_question_analytics WHERE session_id IN ${targetLiveExams};`,
    `DELETE FROM live_exam_chat_messages WHERE session_id IN ${targetLiveExams};`,
    `DELETE FROM live_exam_control_confirmations WHERE live_exam_id IN ${targetLiveExams};`,
    `DELETE FROM live_exam_control_audit WHERE live_exam_id IN ${targetLiveExams} OR target_participant_id IN ${targetParticipants};`,
    `DELETE FROM live_exam_connection_events WHERE live_exam_id IN ${targetLiveExams} OR student_id IN (${targetStudentIds});`,
    `DELETE FROM live_exam_answer_snapshots WHERE live_exam_id IN ${targetLiveExams} OR student_id IN (${targetStudentIds});`,
    `DELETE FROM live_exam_activity WHERE live_exam_id IN ${targetLiveExams} OR student_id IN (${targetStudentIds});`,
    `DELETE FROM live_exam_participants WHERE id IN ${targetParticipants};`,
    `DELETE FROM live_exam_sessions WHERE id IN ${targetLiveExams};`,

    `DELETE FROM hw_submissions WHERE assignment_id IN ${targetHwAssignments} OR student_id IN (${targetStudentIds});`,
    `DELETE FROM hw_assignments WHERE id IN ${targetHwAssignments};`,

    `DELETE FROM intervention_assignment_batches WHERE group_id IN ${targetGroups} OR teacher_username=${p.targetTeacher} OR quiz_id IN ${targetQuiz};`,
    `DELETE FROM intervention_notes WHERE group_id IN ${targetGroups} OR student_id IN (${targetStudentIds}) OR teacher_username=${p.targetTeacher};`,
    `DELETE FROM intervention_group_members WHERE group_id IN ${targetGroups} OR student_id IN (${targetStudentIds});`,
    `DELETE FROM intervention_groups WHERE id IN ${targetGroups};`,

    `DELETE FROM gift_vouchers WHERE order_id IN ${targetGiftOrders} OR student_id IN (${targetStudentIds});`,
    `DELETE FROM gift_order_events WHERE order_id IN ${targetGiftOrders} OR student_id IN (${targetStudentIds});`,
    `DELETE FROM gift_wallet_ledger WHERE ref_order_id IN ${targetGiftOrders} OR student_id IN (${targetStudentIds});`,
    `DELETE FROM gift_orders WHERE id IN ${targetGiftOrders};`,
    `DELETE FROM gift_shop_scope_settings WHERE class_id=${p.oldClassId} OR updated_by=${p.targetTeacher};`,
    `DELETE FROM gift_catalog_items WHERE class_id=${p.oldClassId} OR created_by=${p.targetTeacher};`,

    `DELETE FROM parent_notifications WHERE source_type='result' AND source_id IN (SELECT CAST(id AS TEXT) FROM results WHERE id IN ${targetResults});`,
    `DELETE FROM results WHERE id IN ${targetResults};`,
    `DELETE FROM assignments WHERE id IN ${targetAssignments};`,
    `DELETE FROM questions WHERE quiz_id IN ${targetQuiz};`,
    `DELETE FROM quiz_drafts WHERE owner_username=${p.targetTeacher};`,
    `DELETE FROM quizzes WHERE id IN ${targetQuiz};`,

    `DELETE FROM auth_sessions WHERE username IN (${targetStudentUsernames}, ${p.targetTeacher});`,
    `DELETE FROM webauthn_challenges WHERE username IN (${targetStudentUsernames}, ${p.targetTeacher});`,
    `DELETE FROM webauthn_credentials WHERE username IN (${targetStudentUsernames}, ${p.targetTeacher});`,
    `DELETE FROM ai_generation_actions WHERE username IN (${targetStudentUsernames}, ${p.targetTeacher});`,
    `DELETE FROM ai_tutor_daily_usage WHERE username IN (${targetStudentUsernames}, ${p.targetTeacher});`,
    `DELETE FROM ai_tutor_reservations WHERE username IN (${targetStudentUsernames}, ${p.targetTeacher});`,
    `DELETE FROM attendance_claims WHERE username IN (${targetStudentUsernames}, ${p.targetTeacher});`,
    `DELETE FROM leaderboard_rewards_history WHERE username IN (${targetStudentUsernames});`,
    `DELETE FROM reward_receipts WHERE username IN (${targetStudentUsernames});`,
    `DELETE FROM student_achievement_unlocks WHERE username IN (${targetStudentUsernames});`,
    `DELETE FROM student_daily_progress WHERE username IN (${targetStudentUsernames});`,
    `DELETE FROM student_game_activity_events WHERE username IN (${targetStudentUsernames});`,
    `DELETE FROM student_game_profiles WHERE username IN (${targetStudentUsernames});`,
    `DELETE FROM student_reward_events WHERE username IN (${targetStudentUsernames});`,
    `DELETE FROM student_weekly_progress WHERE username IN (${targetStudentUsernames});`,
    `DELETE FROM teacher_ai_daily_usage WHERE username=${p.targetTeacher};`,
    `DELETE FROM test_bank WHERE teacher_id=${p.targetTeacher};`,
    `DELETE FROM user_pets WHERE username IN (${targetStudentUsernames});`,
    `DELETE FROM announcements WHERE created_by=${p.targetTeacher} OR updated_by=${p.targetTeacher};`,

    `DELETE FROM students WHERE (id=${quoteSqlLiteral(FIXTURES.students[0].id)} AND username=${quoteSqlLiteral(FIXTURES.students[0].username)}) OR (id=${quoteSqlLiteral(FIXTURES.students[1].id)} AND username=${quoteSqlLiteral(FIXTURES.students[1].username)});`,
    `DELETE FROM classes WHERE id=${p.oldClassId} AND name=${p.oldClassName} AND teacher_username=${p.targetTeacher};`,
    `DELETE FROM teachers WHERE username=${p.targetTeacher} AND role=${quoteSqlLiteral(FIXTURES.teacher.role)};`,

    `INSERT OR IGNORE INTO admin_audit_logs (id, actor_username, action, target_type, target_id, request_id, before_json, after_json, created_at) VALUES (${quoteSqlLiteral(AUDIT_ID)}, 'system', 'PRODUCTION_TEST_DATA_CLEANED', 'production_cleanup', ${quoteSqlLiteral(CLEANUP_CONFIRMATION)}, ${quoteSqlLiteral(requestId)}, ${beforeJson}, ${afterJson}, ${quoteSqlLiteral(now)});`,
    'COMMIT;',
    '',
  ].join('\n');
}

function readSnapshot(options, runner = runWrangler) {
  const output = runner(buildQueryArgs(options, buildSnapshotQuery()), { cwd: options.cwd });
  return groupSnapshotRows(parseWranglerJson(output));
}

function deleteR2Objects(options, runner = runWrangler) {
  const deleted = [];
  const missing = [];
  for (const key of FIXTURES.knownR2Keys) {
    const args = [
      'wrangler',
      'r2',
      'object',
      'delete',
      `${options.r2Bucket}/${key}`,
      '--config',
      options.config,
      '--remote',
      '--force',
    ];
    try {
      runner(args, { cwd: options.cwd });
      deleted.push(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not found|404|NoSuchKey/i.test(message)) missing.push(key);
      else throw error;
    }
  }
  return { deleted, missing };
}

function executeRemoteBatchViaHelper(options, sql) {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tohieuquiz-task38-batch-input-'));
  const inputPath = path.join(tempDirectory, 'batch-input.json');
  try {
    fs.writeFileSync(inputPath, `${JSON.stringify({
      cwd: options.cwd,
      databaseName: options.database,
      databaseId: PRODUCTION_DATABASE_ID,
      sql,
    })}\n`, { encoding: 'utf8', mode: 0o600 });
    const helperPath = path.join(__dirname, 'run-d1-remote-batch.cjs');
    const result = spawnSync(process.execPath, [helperPath, '--input', inputPath], {
      cwd: options.cwd,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || 'D1 remote batch helper failed.');
    }
    return JSON.parse(result.stdout.trim());
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function executeCleanupTransaction(options, sql, dependencies = {}) {
  if (options.mode === 'remote') {
    const executeRemoteBatch = dependencies.executeRemoteBatch || executeRemoteBatchViaHelper;
    return executeRemoteBatch(options, sql);
  }
  const runner = dependencies.runWrangler || runWrangler;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tohieuquiz-task38-cleanup-'));
  const sqlPath = path.join(tempDirectory, 'cleanup.sql');
  try {
    fs.writeFileSync(sqlPath, sql, { encoding: 'utf8', mode: 0o600 });
    runner(buildExecuteArgs(options, sqlPath), { cwd: options.cwd });
    return { ok: true, statementCount: undefined, changes: undefined };
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}
function persistReport(reportPath, report) {
  if (!reportPath) return;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}

function cleanupProductionTestData(rawOptions, dependencies = {}) {
  const options = normalizeOptions(rawOptions);
  const runner = dependencies.runWrangler || runWrangler;
  const now = dependencies.now || new Date().toISOString();
  const requestId = dependencies.requestId || `task38-${crypto.randomUUID()}`;
  const before = validateSnapshot(readSnapshot(options, runner));
  const report = {
    database: options.database,
    mode: options.mode,
    write: options.write,
    status: before.state === 'up-to-date' ? 'up-to-date' : 'dry-run',
    requestId,
    target: CLEANUP_CONFIRMATION,
    preservedAccounts: FIXTURES.preservedStudents.map((entry) => entry.username),
    smokeClass: FIXTURES.smokeClass,
    artifactCounts: before.snapshot.artifactCounts
      .filter((row) => Number(row.row_count) > 0)
      .map((row) => ({ table: row.table_name, rows: Number(row.row_count) })),
    r2: { planned: [...FIXTURES.knownR2Keys], deleted: [], missing: [] },
  };

  if (!options.write) {
    persistReport(options.reportPath, report);
    return report;
  }

  if (before.state === 'ready') {
    report.transaction = executeCleanupTransaction(
      options,
      buildCleanupSql({ requestId, now }),
      { runWrangler: runner, executeRemoteBatch: dependencies.executeRemoteBatch },
    );
  }

  const after = validateSnapshot(readSnapshot(options, runner));
  if (after.state !== 'up-to-date') {
    throw new Error('Post-cleanup verification did not reach the up-to-date state.');
  }
  const r2 = options.mode === 'remote'
    ? deleteR2Objects(options, runner)
    : { deleted: [], missing: [] };
  report.status = before.state === 'up-to-date' ? 'up-to-date' : 'applied';
  report.r2.deleted = r2.deleted;
  report.r2.missing = r2.missing;
  persistReport(options.reportPath, report);
  return report;
}

function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const report = cleanupProductionTestData(cli);
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
  AUDIT_ID,
  CLEANUP_CONFIRMATION,
  FIXTURES,
  PRODUCTION_DATABASE_ID,
  buildCleanupSql,
  buildExecuteArgs,
  buildQueryArgs,
  buildSnapshotQuery,
  cleanupProductionTestData,
  deleteR2Objects,
  executeCleanupTransaction,
  executeRemoteBatchViaHelper,
  groupSnapshotRows,
  normalizeOptions,
  quoteSqlLiteral,
  readBareFlag,
  readSnapshot,
  validateSnapshot,
};
