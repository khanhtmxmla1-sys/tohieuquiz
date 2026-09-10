import writeExcelFile from 'write-excel-file/universal';
import { auditStatement } from '../utils/audit';
import { competitionCursor, competitionLimit, competitionPage } from './pagination';

const D1_SAFE_CHUNK_SIZE = 90;

function chunksOf<T>(items: T[], size = D1_SAFE_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

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
  options: { version?: number; classIds?: string[]; limit?: number | string; cursor?: string } = {},
): Promise<{
  campaignId: string;
  version: number;
  items: CompetitionSchoolExamAdmissionView[];
  approvedCount: number;
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}> {
  const campaignId = normalizedId(campaignIdInput, 'COMPETITION_CAMPAIGN_ID_REQUIRED');
  const version = await resolveVersion(db, campaignId, options.version);
  const limit = competitionLimit(options.limit);
  const classIds = options.classIds === undefined
    ? undefined
    : [...new Set(options.classIds.map((id) => String(id || '').trim()).filter(Boolean))].sort();
  const classScope = options.classIds === undefined ? 'all' : classIds?.join(',') || 'none';
  const scope = `competition-school-exam-admissions:${campaignId}:${version}:${classScope}`;
  const cursor = competitionCursor(
    options.cursor,
    scope,
    4,
    'COMPETITION_SCHOOL_EXAM_ADMISSION_CURSOR_INVALID',
  );
  const cursorGrade = cursor ? Number(cursor[0]) : null;
  if (cursor && (
    !Number.isInteger(cursorGrade)
    || Number(cursorGrade) <= 0
    || !cursor[2]
    || !cursor[3]
  )) throw new Error('COMPETITION_SCHOOL_EXAM_ADMISSION_CURSOR_INVALID');
  if (options.classIds !== undefined && options.classIds.length === 0) {
    return {
      campaignId, version, items: [], approvedCount: 0,
      nextCursor: null, hasMore: false, limit,
    };
  }
  const classFilter = classIds?.length ? ` AND member.class_id_at_snapshot IN (${classIds.map(() => '?').join(', ')})` : '';
  const cursorFilter = cursor
    ? ` AND (
      member.grade_level_at_snapshot,
      COALESCE(classes.name, ''),
      students.full_name,
      eligibility.student_id
    ) > (?, ?, ?, ?)`
    : '';
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
      AND eligibility.qualified = 1${classFilter}${cursorFilter}
    ORDER BY member.grade_level_at_snapshot, COALESCE(classes.name, ''), students.full_name, eligibility.student_id
    LIMIT ?
  `).bind(
    campaignId,
    version,
    ...(classIds || []),
    ...(cursor ? [cursorGrade, cursor[1], cursor[2], cursor[3]] : []),
    limit + 1,
  ).all<AdmissionRow>();
  const page = competitionPage(
    result.results || [],
    limit,
    (row) => [row.grade_level, row.class_name || '', row.full_name, row.student_id],
    scope,
  );
  const items = page.items.map(mapAdmission);
  return {
    campaignId,
    version,
    items,
    approvedCount: items.filter((item) => item.approved).length,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    limit: page.limit,
  };
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
  const requested = [...new Set((input.studentIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (input.approveAllQualified && requested.length > 0) {
    throw new Error('COMPETITION_SCHOOL_EXAM_ADMISSION_PAYLOAD_AMBIGUOUS');
  }
  if (!input.approveAllQualified && requested.length === 0) throw new Error('COMPETITION_SCHOOL_EXAM_ADMISSION_STUDENTS_REQUIRED');
  const version = await resolveVersion(db, campaignId, input.eligibilitySnapshotVersion);

  let qualifiedIds: string[];
  if (input.approveAllQualified) {
    const qualifiedResult = await db.prepare(`
      SELECT student_id FROM competition_eligibility
      WHERE campaign_id = ? AND eligibility_snapshot_version = ? AND qualified = 1
      ORDER BY student_id
    `).bind(campaignId, version).all<{ student_id: string }>();
    qualifiedIds = (qualifiedResult.results || []).map((row) => row.student_id);
  } else {
    const qualified = new Set<string>();
    for (const requestedChunk of chunksOf(requested)) {
      const qualifiedResult = await db.prepare(`
        SELECT student_id FROM competition_eligibility
        WHERE campaign_id = ? AND eligibility_snapshot_version = ? AND qualified = 1
          AND student_id IN (${requestedChunk.map(() => '?').join(', ')})
      `).bind(campaignId, version, ...requestedChunk).all<{ student_id: string }>();
      for (const row of qualifiedResult.results || []) qualified.add(row.student_id);
    }
    qualifiedIds = requested.filter((studentId) => qualified.has(studentId));
  }
  if (!input.approveAllQualified && qualifiedIds.length !== requested.length) {
    throw new Error('COMPETITION_SCHOOL_EXAM_ADMISSION_NOT_QUALIFIED');
  }
  if (qualifiedIds.length === 0) throw new Error('COMPETITION_SCHOOL_EXAM_ADMISSION_EMPTY');

  const alreadyApproved = new Set<string>();
  for (const qualifiedChunk of chunksOf(qualifiedIds)) {
    const approvedResult = await db.prepare(`
      SELECT student_id FROM competition_school_exam_admissions
      WHERE campaign_id = ? AND eligibility_snapshot_version = ?
        AND student_id IN (${qualifiedChunk.map(() => '?').join(', ')})
    `).bind(campaignId, version, ...qualifiedChunk).all<{ student_id: string }>();
    for (const row of approvedResult.results || []) alreadyApproved.add(row.student_id);
  }
  const pendingIds = qualifiedIds.filter((id) => !alreadyApproved.has(id));
  if (pendingIds.length === 0) {
    return { campaignId, version, approvedCount: 0, alreadyApprovedCount: qualifiedIds.length };
  }

  const now = new Date().toISOString();
  const pendingChunks = chunksOf(pendingIds);
  for (let index = 0; index < pendingChunks.length; index += 1) {
    const statements = pendingChunks[index].map((studentId) => db.prepare(`
        INSERT INTO competition_school_exam_admissions (
          campaign_id, eligibility_snapshot_version, student_id, approved_by,
          approved_at, request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(campaignId, version, studentId, actorUsername, now, input.requestId, now));
    if (index === pendingChunks.length - 1) {
      statements.push(auditStatement(db, {
        actorUsername,
        action: 'SCHOOL_EXAM_ADMISSIONS_APPROVED',
        targetType: 'competition_eligibility_snapshot',
        targetId: `${campaignId}:${version}`,
        requestId: input.requestId,
        after: { campaignId, eligibilitySnapshotVersion: version, studentIds: pendingIds },
      }));
    }
    await db.batch(statements);
  }
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
  const items: CompetitionSchoolExamAdmissionView[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const listing = await listCompetitionSchoolExamAdmissions(db, campaignId, {
      ...options,
      limit: 100,
      cursor,
    });
    items.push(...listing.items);
    if (!listing.hasMore || !listing.nextCursor) break;
    if (seenCursors.has(listing.nextCursor)) {
      throw new Error('COMPETITION_SCHOOL_EXAM_ADMISSION_CURSOR_INVALID');
    }
    seenCursors.add(listing.nextCursor);
    cursor = listing.nextCursor;
  } while (true);
  if (items.length === 0) throw new Error('COMPETITION_SCHOOL_EXAM_ADMISSION_EXPORT_EMPTY');
  const data = [
    ['Mã học sinh', 'Họ và tên', 'Tên đăng nhập', 'Khối', 'Lớp', 'Mã lớp', 'Đủ điều kiện lúc', 'Trạng thái duyệt', 'Người duyệt', 'Duyệt lúc'],
    ...items.map((item) => [
      item.studentId, item.fullName, item.username, item.gradeLevel,
      item.className || '', item.classId, item.qualifiedAt || '',
      item.approved ? 'ĐÃ DUYỆT' : 'CHỜ DUYỆT', item.approvedBy || '', item.approvedAt || '',
    ]),
  ];
  return writeExcelFile([{ data, sheet: 'Du_dieu_kien' }]).toBlob();
}
