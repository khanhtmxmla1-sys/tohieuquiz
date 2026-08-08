#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  parseCliArgs,
  parseWranglerJson,
  runWrangler,
} = require('./list-backup-tables.cjs');
const { executeRemoteBatchViaHelper } = require('./cleanup-production-test-data.cjs');

const REPAIR_CONFIRMATION = 'production-smoke-fixtures';
const SMOKE_FIXTURE = Object.freeze({
  studentId: 's-ca79f38f',
  studentUsername: 'smoke.student',
  classId: 'c-production-smoke',
  className: 'Lớp Smoke Production',
  teacherUsername: 'smoke.teacher',
});

function quoteSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function readBareFlag(input, key, cliName = key) {
  const value = input[key];
  if (value === undefined || value === false) return false;
  if (value !== true) throw new Error(`--${cliName} must be a bare flag without a value.`);
  return true;
}

function normalizeOptions(input = {}) {
  const database = String(input.database || 'tohieuquiz-db');
  const config = String(input.config || 'wrangler.toml');
  const cwd = path.resolve(String(input.cwd || path.resolve(__dirname, '..')));
  const remote = input.mode === 'remote' || readBareFlag(input, 'remote');
  const local = input.mode === 'local' || readBareFlag(input, 'local');
  if (remote === local) throw new Error('Choose exactly one D1 target mode: --local or --remote.');

  const mode = remote ? 'remote' : 'local';
  const confirmRemote = input.confirmRemote || input['confirm-remote'];
  const confirmRepair = input.confirmRepair || input['confirm-repair'];
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
  if (write && confirmRepair !== REPAIR_CONFIRMATION) {
    throw new Error(`Repair writes require --confirm-repair ${REPAIR_CONFIRMATION}`);
  }

  return {
    database,
    config,
    cwd,
    mode,
    write,
    confirmRemote: confirmRemote ? String(confirmRemote) : undefined,
    confirmRepair: confirmRepair ? String(confirmRepair) : undefined,
    persistTo: persistTo ? path.resolve(String(persistTo)) : undefined,
    reportPath: reportPath ? path.resolve(String(reportPath)) : undefined,
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

function buildSnapshotQuery() {
  const studentId = quoteSqlLiteral(SMOKE_FIXTURE.studentId);
  const username = quoteSqlLiteral(SMOKE_FIXTURE.studentUsername);
  const teacherUsername = quoteSqlLiteral(SMOKE_FIXTURE.teacherUsername);
  return `
    SELECT
      s.id AS student_id,
      s.username AS student_username,
      s.class_id AS student_class_id,
      s.archived_at AS student_archived_at,
      c.id AS class_id,
      c.name AS class_name,
      c.teacher_username AS class_teacher_username,
      c.archived_at AS class_archived_at,
      t.username AS teacher_username,
      t.role AS teacher_role,
      t.status AS teacher_status,
      (
        SELECT COUNT(*)
        FROM parent_links pl
        WHERE pl.student_id = s.id
          AND pl.status = 'ACTIVE'
          AND COALESCE(pl.pin_hash, '') <> ''
      ) AS active_parent_links
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    LEFT JOIN teachers t ON t.username = ${teacherUsername}
    WHERE s.id = ${studentId} AND s.username = ${username}
    LIMIT 1;
  `.trim();
}

function readSnapshot(options, runner = runWrangler) {
  const rows = parseWranglerJson(runner(buildQueryArgs(options, buildSnapshotQuery()), { cwd: options.cwd }));
  const row = rows[0];
  if (!row) {
    return {
      student: null,
      smokeClass: null,
      teacher: null,
      activeParentLinks: 0,
    };
  }
  return {
    student: {
      id: row.student_id,
      username: row.student_username,
      class_id: row.student_class_id,
      archived_at: row.student_archived_at ?? null,
    },
    smokeClass: row.class_id ? {
      id: row.class_id,
      name: row.class_name,
      teacher_username: row.class_teacher_username,
      archived_at: row.class_archived_at ?? null,
    } : null,
    teacher: row.teacher_username ? {
      username: row.teacher_username,
      role: row.teacher_role,
      status: row.teacher_status,
    } : null,
    activeParentLinks: Number(row.active_parent_links || 0),
  };
}

function validateSnapshot(input) {
  const student = input?.student;
  if (
    !student
    || student.id !== SMOKE_FIXTURE.studentId
    || student.username !== SMOKE_FIXTURE.studentUsername
    || student.class_id !== SMOKE_FIXTURE.classId
  ) {
    throw new Error('Production smoke student identity does not match the reserved fixture.');
  }

  const smokeClass = input?.smokeClass;
  if (
    !smokeClass
    || smokeClass.id !== SMOKE_FIXTURE.classId
    || smokeClass.name !== SMOKE_FIXTURE.className
    || smokeClass.teacher_username !== SMOKE_FIXTURE.teacherUsername
  ) {
    throw new Error('Production smoke class identity does not match the reserved fixture.');
  }

  const teacher = input?.teacher;
  if (
    !teacher
    || teacher.username !== SMOKE_FIXTURE.teacherUsername
    || teacher.role !== 'teacher'
    || teacher.status !== 'ACTIVE'
  ) {
    throw new Error('Production smoke teacher identity is missing or inactive.');
  }

  if (Number(input?.activeParentLinks || 0) < 1) {
    throw new Error('Production smoke fixture does not have an active parent link with a PIN.');
  }

  const needsRepair = Boolean(student.archived_at) || Boolean(smokeClass.archived_at);
  return { state: needsRepair ? 'repairable' : 'healthy', snapshot: input };
}

function buildRepairSql({ requestId, now }) {
  const auditId = quoteSqlLiteral(`audit-smoke-fixture-repair-${requestId}`);
  const request = quoteSqlLiteral(requestId);
  const createdAt = quoteSqlLiteral(now);
  const classId = quoteSqlLiteral(SMOKE_FIXTURE.classId);
  const className = quoteSqlLiteral(SMOKE_FIXTURE.className);
  const teacherUsername = quoteSqlLiteral(SMOKE_FIXTURE.teacherUsername);
  const studentId = quoteSqlLiteral(SMOKE_FIXTURE.studentId);
  const studentUsername = quoteSqlLiteral(SMOKE_FIXTURE.studentUsername);
  const beforeJson = quoteSqlLiteral(JSON.stringify({ action: 'unarchive_reserved_smoke_fixture' }));
  const afterJson = quoteSqlLiteral(JSON.stringify({ classArchived: false, studentArchived: false }));

  return [
    'PRAGMA foreign_keys=ON;',
    'BEGIN IMMEDIATE;',
    `UPDATE classes SET archived_at=NULL WHERE id=${classId} AND name=${className} AND teacher_username=${teacherUsername};`,
    `UPDATE students SET archived_at=NULL WHERE id=${studentId} AND username=${studentUsername} AND class_id=${classId};`,
    `INSERT OR IGNORE INTO admin_audit_logs (id, actor_username, action, target_type, target_id, request_id, before_json, after_json, created_at) VALUES (${auditId}, 'system', 'PRODUCTION_SMOKE_FIXTURES_REPAIRED', 'production_smoke_fixture', ${classId}, ${request}, ${beforeJson}, ${afterJson}, ${createdAt});`,
    'COMMIT;',
    '',
  ].join('\n');
}

function persistReport(reportPath, report) {
  if (!reportPath) return;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}

function repairProductionSmokeFixtures(rawOptions, dependencies = {}) {
  const options = normalizeOptions(rawOptions);
  const runner = dependencies.runWrangler || runWrangler;
  const executeRemoteBatch = dependencies.executeRemoteBatch || executeRemoteBatchViaHelper;
  const requestId = dependencies.requestId || `smoke-repair-${crypto.randomUUID()}`;
  const now = dependencies.now || new Date().toISOString();
  const before = validateSnapshot(readSnapshot(options, runner));
  const report = {
    database: options.database,
    mode: options.mode,
    write: options.write,
    status: before.state === 'healthy' ? 'healthy' : 'dry-run',
    fixture: {
      studentId: SMOKE_FIXTURE.studentId,
      classId: SMOKE_FIXTURE.classId,
      teacherUsername: SMOKE_FIXTURE.teacherUsername,
    },
    before: {
      studentArchived: Boolean(before.snapshot.student.archived_at),
      classArchived: Boolean(before.snapshot.smokeClass.archived_at),
      activeParentLinks: before.snapshot.activeParentLinks,
    },
    requestId,
  };

  if (!options.write || before.state === 'healthy') {
    persistReport(options.reportPath, report);
    return report;
  }
  if (options.mode !== 'remote') {
    throw new Error('Repair writes are intentionally restricted to the confirmed remote production database.');
  }

  report.transaction = executeRemoteBatch(options, buildRepairSql({ requestId, now }));
  const after = validateSnapshot(readSnapshot(options, runner));
  if (after.state !== 'healthy') {
    throw new Error('Post-repair verification did not restore the reserved production smoke fixtures.');
  }
  report.status = 'applied';
  report.after = {
    studentArchived: Boolean(after.snapshot.student.archived_at),
    classArchived: Boolean(after.snapshot.smokeClass.archived_at),
    activeParentLinks: after.snapshot.activeParentLinks,
  };
  persistReport(options.reportPath, report);
  return report;
}

function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const report = repairProductionSmokeFixtures(cli);
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
  REPAIR_CONFIRMATION,
  SMOKE_FIXTURE,
  buildQueryArgs,
  buildRepairSql,
  buildSnapshotQuery,
  normalizeOptions,
  readSnapshot,
  repairProductionSmokeFixtures,
  validateSnapshot,
};
