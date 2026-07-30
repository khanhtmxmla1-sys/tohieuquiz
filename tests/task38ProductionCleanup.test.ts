// @vitest-environment node

import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  CLEANUP_CONFIRMATION,
  FIXTURES,
  buildCleanupSql,
  normalizeOptions,
  validateSnapshot,
} = require('../workers/scripts/cleanup-production-test-data.cjs');

const baseSnapshot = {
  targetTeacher: [{ username: 'test.gv1', role: 'teacher' }],
  targetStudents: [
    { id: 's-9df31170', username: 'test.hs1', class_id: 'c-cd364c7d' },
    { id: 's-c1e80cb7', username: 'test.hs2', class_id: 'c-cd364c7d' },
  ],
  targetClass: [{ id: 'c-cd364c7d', name: 'Lớp Test 1', teacher_username: 'test.gv1' }],
  preservedStudents: [
    { id: 's-ca79f38f', username: 'smoke.student', class_id: 'c-cd364c7d' },
    { id: 's-e4ba05c6', username: 'thienkhanh', class_id: 'c-cd364c7d' },
  ],
  smokeTeacher: [{ username: 'smoke.teacher', role: 'teacher' }],
  protectedOwners: [
    { username: 'tongminhkhanh' },
    { username: 'admin' },
    { username: 'viethong' },
    { username: 'smoke.admin' },
  ],
};

describe('Task 38 production cleanup safety', () => {
  it('defaults to dry-run and requires exact double confirmation for writes', () => {
    expect(normalizeOptions({
      remote: true,
      database: 'tohieuquiz-db',
      confirmRemote: 'tohieuquiz-db',
    })).toMatchObject({ mode: 'remote', write: false });

    expect(() => normalizeOptions({
      remote: true,
      database: 'tohieuquiz-db',
      confirmRemote: 'tohieuquiz-db',
      write: true,
    })).toThrow(/confirm-cleanup/i);

    expect(normalizeOptions({
      remote: true,
      database: 'tohieuquiz-db',
      confirmRemote: 'tohieuquiz-db',
      confirmCleanup: CLEANUP_CONFIRMATION,
      write: true,
    })).toMatchObject({ mode: 'remote', write: true });
  });

  it('fails closed when the old class contains an unexpected account', () => {
    expect(() => validateSnapshot({
      ...baseSnapshot,
      preservedStudents: [
        ...baseSnapshot.preservedStudents,
        { id: 's-unexpected', username: 'real.student', class_id: 'c-cd364c7d' },
      ],
    })).toThrow(/unexpected class occupant/i);
  });

  it('requires protected owners and dedicated smoke accounts to remain present', () => {
    expect(() => validateSnapshot({
      ...baseSnapshot,
      protectedOwners: baseSnapshot.protectedOwners.filter((row) => row.username !== 'tongminhkhanh'),
    })).toThrow(/tongminhkhanh/i);
    expect(() => validateSnapshot({ ...baseSnapshot, smokeTeacher: [] })).toThrow(/smoke\.teacher/i);
  });
});

describe('Task 38 cleanup transaction', () => {
  it('moves preserved accounts, removes exact fixtures, keeps audit history, and is idempotent', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync('workers/schema.sql', 'utf8'));
    db.exec(`
      INSERT INTO teachers(username,password,full_name,role,class,status,must_change_password,token_version,created_at,updated_at) VALUES
        ('test.gv1','x','Test Teacher','teacher','','ACTIVE',0,1,'2026-07-26','2026-07-26'),
        ('smoke.teacher','x','Smoke Teacher','teacher','Lớp Test 1','ACTIVE',0,1,'2026-07-30','2026-07-30'),
        ('tongminhkhanh','x','Owner','teacher','','ACTIVE',0,1,'2026-07-26','2026-07-26'),
        ('admin','x','Admin','admin','','ACTIVE',0,1,'2026-07-26','2026-07-26'),
        ('viethong','x','Admin 2','admin','','ACTIVE',0,1,'2026-07-27','2026-07-27'),
        ('smoke.admin','x','Smoke Admin','admin','','ACTIVE',0,1,'2026-07-30','2026-07-30');
      INSERT INTO classes(id,name,teacher_username,created_at) VALUES
        ('c-cd364c7d','Lớp Test 1','test.gv1','2026-07-26');
      INSERT INTO students(id,full_name,username,password_hash,class_id,created_at) VALUES
        ('s-9df31170','Test One','test.hs1','x','c-cd364c7d','2026-07-26'),
        ('s-c1e80cb7','Test Two','test.hs2','x','c-cd364c7d','2026-07-26'),
        ('s-e4ba05c6','Preserved','thienkhanh','x','c-cd364c7d','2026-07-26'),
        ('s-ca79f38f','Smoke Student','smoke.student','x','c-cd364c7d','2026-07-30');
      INSERT INTO quizzes(id,title,class_level,created_at,created_by) VALUES
        ('q-test-gd5-toan','[TEST] Quiz','3','2026-07-26','test.gv1');
      INSERT INTO questions(id,quiz_id,type,question) VALUES
        ('q1','q-test-gd5-toan','MCQ','test');
      INSERT INTO assignments(id,quiz_id,class_id,student_id,deadline,created_at) VALUES
        ('a-test','q-test-gd5-toan','c-cd364c7d','','2026-08-01','2026-07-26');
      INSERT INTO results(student_id,assignment_id,student_name,class_name,quiz_id,quiz_title,submitted_at) VALUES
        ('s-9df31170','a-test','Test One','Lớp Test 1','q-test-gd5-toan','[TEST] Quiz','2026-07-26');
      INSERT INTO admin_audit_logs(id,actor_username,action,target_type,target_id,request_id,created_at) VALUES
        ('historic','test.gv1','OLD_TEST_ACTION','quiz','q-test-gd5-toan','old-request','2026-07-26');
    `);

    const sql = buildCleanupSql({ requestId: 'task38-test-request', now: '2026-07-30T09:00:00.000Z' });
    db.exec(sql);
    db.exec(sql);

    expect(db.prepare("SELECT COUNT(*) AS count FROM teachers WHERE username='test.gv1'").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM students WHERE username IN ('test.hs1','test.hs2')").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM classes WHERE name='Lớp Test 1'").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM quizzes WHERE id='q-test-gd5-toan'").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT class_id FROM students WHERE username='smoke.student'").get()).toEqual({ class_id: FIXTURES.smokeClass.id });
    expect(db.prepare("SELECT class_id FROM students WHERE username='thienkhanh'").get()).toEqual({ class_id: FIXTURES.smokeClass.id });
    expect(db.prepare("SELECT COUNT(*) AS count FROM teachers WHERE username='tongminhkhanh'").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM admin_audit_logs WHERE id='historic'").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM admin_audit_logs WHERE action='PRODUCTION_TEST_DATA_CLEANED'").get()).toEqual({ count: 1 });
  });
});
