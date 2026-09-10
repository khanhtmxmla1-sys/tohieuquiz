// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { readSheet } from 'read-excel-file/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveCompetitionSchoolExamAdmissions,
  buildCompetitionSchoolExamAdmissionsWorkbook,
  listCompetitionSchoolExamAdmissions,
} from '../workers/src/competition/schoolExamAdmissionService';
import { createSqliteD1 } from './helpers/sqliteD1';

const coreMigration = readFileSync(new URL('../workers/migrations/0069_competition_core.sql', import.meta.url), 'utf8');
const admissionMigration = readFileSync(new URL('../workers/migrations/0081_competition_school_exam_admissions.sql', import.meta.url), 'utf8');

let sqlite: DatabaseSync;
let d1: D1Database;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2027-03-02T08:00:00.000Z'));
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE students (
      id TEXT PRIMARY KEY, full_name TEXT NOT NULL, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '', class_id TEXT NOT NULL, created_at TEXT NOT NULL,
      archived_at TEXT
    );
    CREATE TABLE classes (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, teacher_username TEXT NOT NULL,
      created_at TEXT NOT NULL, archived_at TEXT
    );
    CREATE TABLE quizzes (id TEXT PRIMARY KEY);
    CREATE TABLE admin_audit_logs (
      id TEXT PRIMARY KEY, actor_username TEXT NOT NULL, action TEXT NOT NULL,
      target_type TEXT NOT NULL, target_id TEXT NOT NULL, request_id TEXT NOT NULL,
      before_json TEXT, after_json TEXT, created_at TEXT NOT NULL
    );
  `);
  sqlite.exec(coreMigration);
  sqlite.exec(admissionMigration);
  sqlite.exec(`
    INSERT INTO classes VALUES ('class-4a', '4A', 'teacher-4', '2026-08-01', NULL);
    INSERT INTO students (id, full_name, username, class_id, created_at) VALUES
      ('student-1', 'Nguyễn An', 'nguyenan', 'class-4a', '2026-08-01'),
      ('student-2', 'Trần Bình', 'tranbinh', 'class-4a', '2026-08-01');
    INSERT INTO competition_campaigns (
      id, title, school_year, timezone, status, audience_rule_json, audience_snapshot_id,
      eligibility_policy_json, starts_at, ends_at, created_by, created_at, updated_at
    ) VALUES (
      'campaign-1', 'Trạng Nguyên Nhí', '2026-2027', 'Asia/Ho_Chi_Minh', 'ELIGIBILITY_LOCKED',
      '{}', 'audience-1', '{"requiredRounds":6,"requiredPassedRounds":6}',
      '2026-09-01', '2027-05-31', 'admin', '2026-08-20', '2026-08-20'
    );
    INSERT INTO competition_audience_snapshots (
      id, campaign_id, version, status, member_count, snapshot_hash, created_at, locked_at, created_by
    ) VALUES ('audience-1', 'campaign-1', 1, 'BUILDING', 2, 'pending', '2026-08-20', NULL, 'admin');
    INSERT INTO competition_audience_members VALUES
      ('audience-1', 'student-1', 4, 'class-4a', 'ACTIVE'),
      ('audience-1', 'student-2', 4, 'class-4a', 'ACTIVE');
    UPDATE competition_audience_snapshots
    SET status = 'LOCKED', snapshot_hash = '${'a'.repeat(64)}', locked_at = '2026-08-20'
    WHERE id = 'audience-1';
    INSERT INTO competition_eligibility (
      id, campaign_id, eligibility_snapshot_version, student_id, qualified,
      reason_codes_json, qualified_at, computed_at, progress_digest
    ) VALUES
      ('elig-1', 'campaign-1', 1, 'student-1', 1, '["QUALIFIED"]', '2027-03-01', '2027-03-01', '${'b'.repeat(64)}'),
      ('elig-2', 'campaign-1', 1, 'student-2', 0, '["ROUND_6_NOT_PASSED"]', NULL, '2027-03-01', '${'c'.repeat(64)}');
  `);
  d1 = createSqliteD1(sqlite);
});

afterEach(() => {
  vi.useRealTimers();
  sqlite.close();
});

describe('Competition school-exam admissions', () => {
  it('approves only qualified students and records actor, time, and audit evidence', async () => {
    await expect(approveCompetitionSchoolExamAdmissions(d1, {
      campaignId: 'campaign-1', eligibilitySnapshotVersion: 1,
      studentIds: ['student-2'], requestId: 'approve-invalid-0001',
    }, 'admin')).rejects.toThrow('COMPETITION_SCHOOL_EXAM_ADMISSION_NOT_QUALIFIED');

    const result = await approveCompetitionSchoolExamAdmissions(d1, {
      campaignId: 'campaign-1', eligibilitySnapshotVersion: 1,
      studentIds: ['student-1'], requestId: 'approve-valid-0001',
    }, 'admin');
    expect(result).toMatchObject({ approvedCount: 1, alreadyApprovedCount: 0 });

    const listing = await listCompetitionSchoolExamAdmissions(d1, 'campaign-1', { version: 1 });
    expect(listing.items).toEqual([
      expect.objectContaining({
        studentId: 'student-1', fullName: 'Nguyễn An', username: 'nguyenan',
        classId: 'class-4a', className: '4A', gradeLevel: 4, approved: true,
        approvedBy: 'admin', approvedAt: '2027-03-02T08:00:00.000Z',
      }),
    ]);
    expect(sqlite.prepare("SELECT action, request_id FROM admin_audit_logs WHERE action = 'SCHOOL_EXAM_ADMISSIONS_APPROVED'").get())
      .toEqual({ action: 'SCHOOL_EXAM_ADMISSIONS_APPROVED', request_id: 'approve-valid-0001' });
  });

  it('bulk approves all qualified students idempotently and exports an XLSX roster', async () => {
    const first = await approveCompetitionSchoolExamAdmissions(d1, {
      campaignId: 'campaign-1', eligibilitySnapshotVersion: 1,
      approveAllQualified: true, requestId: 'approve-all-0001',
    }, 'admin');
    expect(first).toMatchObject({ approvedCount: 1, alreadyApprovedCount: 0 });

    const replay = await approveCompetitionSchoolExamAdmissions(d1, {
      campaignId: 'campaign-1', eligibilitySnapshotVersion: 1,
      approveAllQualified: true, requestId: 'approve-all-0001',
    }, 'admin');
    expect(replay).toMatchObject({ approvedCount: 0, alreadyApprovedCount: 1 });

    const blob = await buildCompetitionSchoolExamAdmissionsWorkbook(d1, 'campaign-1', { version: 1 });
    const rows = await readSheet(Buffer.from(await blob.arrayBuffer()), { sheet: 'Du_dieu_kien' });
    expect(rows[0]).toEqual(expect.arrayContaining(['Mã học sinh', 'Họ và tên', 'Trạng thái duyệt']));
    expect(rows[1]).toEqual(expect.arrayContaining(['student-1', 'Nguyễn An', 'ĐÃ DUYỆT']));
  });
});
