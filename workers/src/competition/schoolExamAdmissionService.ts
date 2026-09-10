import writeExcelFile from 'write-excel-file/universal';
import { auditStatement } from '../utils/audit';

interface AdmissionRow {
  student_id: string;
  full_name: string;
  username: string;
  class_id: string;
  class_name: string | null;
  grade_level: number;
  qualified_at: string | null;
  reason_codes_json: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface CompetitionSchoolExamAdmissionView {
  studentId: string;
  fullName: string;
  username: string;
  classId: string;
  className: string | null;
  gradeLevel: number;
  qualifiedAt: string | null;
  reasonCodes: string[];
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
}

function normalizedId(value: string, code: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

async function resolveVersion(db: D1Database, campaignId: string, requested?: number): Promise<number> {
  if (requested !== undefined) {
    if (!Number.isInteger(requested) || requested <= 0) throw new Error('COMPETITION_ELIGIBILITY_VERSION_INVALID');
    return requested;
  }
  const row = await db.prepare(`
    SELECT COALESCE(MAX(eligibility_snapshot_version), 0) AS version
    FROM competition_eligibility WHERE campaign_id = ?
  `).bind(campaignId).first<{ version: number }>();
  const version = Number(row?.version || 0);
  if (version <= 0) throw new Error('COMPETITION_ELIGIBILITY_NOT_FINALIZED');
  return version;
}

function mapAdmission(row: AdmissionRow): CompetitionSchoolExamAdmissionView {
  let reasonCodes: string[] = [];
  try { reasonCodes = JSON.parse(row.reason_codes_json || '[]') as string[]; } catch { reasonCodes = []; }
  return {
    studentId: row.student_id,
    fullName: row.full_name,
    username: row.username,
    classId: row.class_id,
    className: row.class_name,
    gradeLevel: Number(row.grade_level),
    qualifiedAt: row.qualified_at,
    reasonCodes,
    approved: Boolean(row.approved_at),
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
  };
}

export async function listCompetitionSchoolExamAdmissions(
  db: D1Database,
  campaignIdInput: string,
  options: { version?: number; classIds?: string[] } = {},
): Promise<{ campaignId: string; version: number; items: CompetitionSchoolExamAdmissionView[]; approvedCount: number }> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const version = await resolveVersion(db, campaignId, options.version);
  if (options.classIds !== undefined && options.classIds.length === 0) {
    return { campaignId, version, items: [], approvedCount: 0 };
  }
  const classIds = options.classIds?.map((id) => String(id || '').trim()).filter(Boolean);
  const classFilter = classIds?.length ? ` AND member.class_id_at_snapshot IN (${classIds.map(() => '?').join(', ')})` : '';
  const result = await db.prepare(`
    SELECT eligibility.student_id, students.full_name, students.username,
           member.class_id_at_snapshot AS class_id, classes.name AS class_name,
           member.grade_level_at_snapshot AS grade_level, eligibility.qualified_at,
           eligibility.reason_codes_json, admission.approved_by, admission.approved_at
    FROM competition_eligibility AS eligibility
    JOIN competition_campaigns AS campaign ON campaign.id = eligibility.campaign_id
    JOIN competition_audience_members AS member
      ON member.audience_snapshot_id = campaign.audience_snapshot_id
     AND member.student_id = eligibility.student_id
    JOIN students ON students.id = eligibility.student_id
    LEFT JOIN classes ON classes.id = member.class_id_at_snapshot
    LEFT JOIN competition_school_exam_admissions AS admission
      ON admission.campaign_id = eligibility.campaign_id
     AND admission.eligibility_snapshot_version = eligibility.eligibility_snapshot_version
     AND admission.student_id = eligibility.student_id
    WHERE eligibility.campaign_id = ?
      AND eligibility.eligibility_snapshot_version = ?
      AND eligibility.qualified = 1${classFilter}
    ORDER BY member.grade_level_at_snapshot, classes.name, students.full_name, eligibility.student_id
  `).bind(campaignId, version, ...(classIds || [])).all<AdmissionRow>();
  const items = (result.results || []).map(mapAdmission);
  return { campaignId, version, items, approvedCount: items.filter((item) => item.approved).length };
}

export async function approveCompetitionSchoolExamAdmissions(
  db: D1Database,
  input: {
    campaignId: string;
    eligibilitySnapshotVersion: number;
    studentIds?: string[];
    approveAllQualified?: boolean;
    requestId: string;
  },
  actorUsername: string,
): Promise<{ campaignId: string; version: number; approvedCount: number; alreadyApprovedCount: number }> {
  const campaignId = normalizedId(input.campaignId, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const version = await resolveVersion(db, campaignId, input.eligibilitySnapshotVersion);
  const requested = [...new Set((input.studentIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!input.approveAllQualified && requested.length === 0) throw new Error('COMPETITION_SCHOOL_EXAM_ADMISSION_STUDENTS_REQUIRED');

  const filter = input.approveAllQualified
    ? ''
    : ` AND student_id IN (${requested.map(() => '?').join(', ')})`;
  const qualifiedResult = await db.prepare(`
    SELECT student_id FROM competition_eligibility
    WHERE campaign_id = ? AND eligibility_snapshot_version = ? AND qualified = 1${filter}
    ORDER BY student_id
  `).bind(campaignId, version, ...requested).all<{ student_id: string }>();
  const qualifiedIds = (qualifiedResult.results || []).map((row) => row.student_id);
  if (!input.approveAllQualified && qualifiedIds.length !== requested.length) {
    throw new Error('COMPETITION_SCHOOL_EXAM_ADMISSION_NOT_QUALIFIED');
  }
  if (qualifiedIds.length === 0) throw new Error('COMPETITION_SCHOOL_EXAM_ADMISSION_EMPTY');

  const approvedResult = await db.prepare(`
    SELECT student_id FROM competition_school_exam_admissions
    WHERE campaign_id = ? AND eligibility_snapshot_version = ?
      AND student_id IN (${qualifiedIds.map(() => '?').join(', ')})
  `).bind(campaignId, version, ...qualifiedIds).all<{ student_id: string }>();
  const alreadyApproved = new Set((approvedResult.results || []).map((row) => row.student_id));
  const pendingIds = qualifiedIds.filter((id) => !alreadyApproved.has(id));
  if (pendingIds.length === 0) {
    return { campaignId, version, approvedCount: 0, alreadyApprovedCount: qualifiedIds.length };
  }

  const now = new Date().toISOString();
  await db.batch([
    ...pendingIds.map((studentId) => db.prepare(`
      INSERT INTO competition_school_exam_admissions (
        campaign_id, eligibility_snapshot_version, student_id, approved_by,
        approved_at, request_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(campaignId, version, studentId, actorUsername, now, input.requestId, now)),
    auditStatement(db, {
      actorUsername,
      action: 'SCHOOL_EXAM_ADMISSIONS_APPROVED',
      targetType: 'competition_eligibility_snapshot',
      targetId: `${campaignId}:${version}`,
      requestId: input.requestId,
      after: { campaignId, eligibilitySnapshotVersion: version, studentIds: pendingIds },
    }),
  ]);
  return {
    campaignId,
    version,
    approvedCount: pendingIds.length,
    alreadyApprovedCount: qualifiedIds.length - pendingIds.length,
  };
}

export async function assertCompetitionSchoolExamAdmissions(
  db: D1Database,
  campaignId: string,
  eligibilitySnapshotVersion: number,
  studentIds: string[],
): Promise<void> {
  const placeholders = studentIds.map(() => '?').join(', ');
  const row = await db.prepare(`
    SELECT COUNT(*) AS count FROM competition_school_exam_admissions
    WHERE campaign_id = ? AND eligibility_snapshot_version = ?
      AND student_id IN (${placeholders})
  `).bind(campaignId, eligibilitySnapshotVersion, ...studentIds).first<{ count: number }>();
  if (Number(row?.count || 0) !== studentIds.length) throw new Error('SCHOOL_EXAM_ROOM_MEMBER_NOT_APPROVED');
}

export async function buildCompetitionSchoolExamAdmissionsWorkbook(
  db: D1Database,
  campaignId: string,
  options: { version?: number; classIds?: string[] } = {},
): Promise<Blob> {
  const listing = await listCompetitionSchoolExamAdmissions(db, campaignId, options);
  if (listing.items.length === 0) throw new Error('COMPETITION_SCHOOL_EXAM_ADMISSION_EXPORT_EMPTY');
  const data = [
    ['Mã học sinh', 'Họ và tên', 'Tên đăng nhập', 'Khối', 'Lớp', 'Mã lớp', 'Đủ điều kiện lúc', 'Trạng thái duyệt', 'Người duyệt', 'Duyệt lúc'],
    ...listing.items.map((item) => [
      item.studentId, item.fullName, item.username, item.gradeLevel,
      item.className || '', item.classId, item.qualifiedAt || '',
      item.approved ? 'ĐÃ DUYỆT' : 'CHỜ DUYỆT', item.approvedBy || '', item.approvedAt || '',
    ]),
  ];
  return writeExcelFile([{ data, sheet: 'Du_dieu_kien' }]).toBlob();
}
