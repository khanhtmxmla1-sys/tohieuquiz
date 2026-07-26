import type {
  ResultReportAttemptPolicy,
  ResultReportBatchDetail,
  ResultReportBatchStatus,
  ResultReportDraftInput,
  ResultReportParentStatus,
  ResultReportStudentStatus,
  StudentResultReportDetail,
  StudentResultReportSummary,
} from '../../../../shared/result-reports.contract';
import { PUBLIC_PHIEU_HOST } from '../phieu/constants';

export interface ResultReportBatchRecord {
  id: string;
  teacherId: string;
  requestId: string | null;
  classId: string;
  className: string;
  quizId: string;
  quizTitle: string;
  attemptPolicy: ResultReportAttemptPolicy;
  notifyStudents: boolean;
  createParentLinks: boolean;
  deliveryStatus: ResultReportBatchStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResultReportDeliveryItemRecord {
  id: string;
  batchId: string;
  resultId: string;
  phieuId: string | null;
  studentId: string | null;
  studentName: string;
  parentPhone: string | null;
  notificationId: string | null;
  publicLinkId: string | null;
  studentStatus: ResultReportStudentStatus;
  parentStatus: ResultReportParentStatus;
  attemptCount: number;
  lastError: string | null;
  draft: ResultReportDraftInput;
  createdAt: string;
  updatedAt: string;
}

export interface ResultReportDeliveryItemCreate extends ResultReportDeliveryItemRecord {}

interface ResultReportBatchDbRow {
  id: string;
  teacher_id: string;
  request_id: string | null;
  class_id: string;
  class_name: string | null;
  quiz_id: string | null;
  title: string | null;
  attempt_policy: ResultReportAttemptPolicy | null;
  notify_students: number;
  create_parent_links: number;
  delivery_status: ResultReportBatchStatus;
  expires_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ResultReportItemDbRow {
  id: string;
  batch_id: string;
  result_id: string;
  phieu_id: string | null;
  student_id: string | null;
  student_name: string;
  parent_phone: string | null;
  notification_id: string | null;
  public_link_id: string | null;
  student_status: ResultReportStudentStatus;
  parent_status: ResultReportParentStatus;
  attempt_count: number;
  last_error: string | null;
  draft_json: string;
  created_at: string;
  updated_at: string;
}

export interface ResultReportDeliveryDetailRow extends ResultReportItemDbRow {
  notification_read?: number | null;
  public_link_view_count?: number | null;
  public_link_active?: number | null;
  public_token?: string | null;
  score?: number | null;
  submitted_at?: string | null;
}

const mapBatch = (row: ResultReportBatchDbRow): ResultReportBatchRecord => ({
  id: row.id,
  teacherId: row.teacher_id,
  requestId: row.request_id,
  classId: row.class_id,
  className: row.class_name || row.class_id,
  quizId: row.quiz_id || '',
  quizTitle: row.title || 'Bài kiểm tra',
  attemptPolicy: row.attempt_policy || 'latest',
  notifyStudents: Number(row.notify_students) === 1,
  createParentLinks: Number(row.create_parent_links) === 1,
  deliveryStatus: row.delivery_status || 'draft',
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at || row.created_at,
});

const parseDraft = (value: string): ResultReportDraftInput => {
  try {
    return JSON.parse(value || '{}') as ResultReportDraftInput;
  } catch {
    return {
      resultId: '',
      style: 'nhe_nhang',
      commentMode: 'manual',
      comment: '',
      needsImprovement: '',
      encouragement: '',
    };
  }
};

const mapItem = (row: ResultReportItemDbRow): ResultReportDeliveryItemRecord => ({
  id: row.id,
  batchId: row.batch_id,
  resultId: row.result_id,
  phieuId: row.phieu_id,
  studentId: row.student_id,
  studentName: row.student_name,
  parentPhone: row.parent_phone,
  notificationId: row.notification_id,
  publicLinkId: row.public_link_id,
  studentStatus: row.student_status,
  parentStatus: row.parent_status,
  attemptCount: Number(row.attempt_count) || 0,
  lastError: row.last_error,
  draft: parseDraft(row.draft_json),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const batchSelect = `
  SELECT b.id, b.teacher_id, b.request_id, b.class_id, c.name AS class_name,
         b.quiz_id, b.title, b.attempt_policy, b.notify_students,
         b.create_parent_links, b.delivery_status, b.expires_at,
         b.created_at, b.updated_at
  FROM phieu_batch b
  LEFT JOIN classes c ON c.id = b.class_id
`;

export async function findResultReportBatchByRequest(
  db: D1Database,
  teacherId: string,
  requestId: string,
): Promise<ResultReportBatchRecord | null> {
  const row = await db.prepare(`${batchSelect}
    WHERE b.teacher_id = ? AND b.request_id = ?
    LIMIT 1
  `).bind(teacherId, requestId).first<ResultReportBatchDbRow>();
  return row ? mapBatch(row) : null;
}

export async function getOwnedResultReportBatch(
  db: D1Database,
  batchId: string,
  teacherId: string,
  isAdmin = false,
): Promise<ResultReportBatchRecord | null> {
  const row = isAdmin
    ? await db.prepare(`${batchSelect}
        WHERE b.id = ? AND b.request_id IS NOT NULL LIMIT 1
      `).bind(batchId).first<ResultReportBatchDbRow>()
    : await db.prepare(`${batchSelect}
        WHERE b.id = ? AND b.teacher_id = ? AND b.request_id IS NOT NULL LIMIT 1
      `).bind(batchId, teacherId).first<ResultReportBatchDbRow>();
  return row ? mapBatch(row) : null;
}

export async function createResultReportBatch(
  db: D1Database,
  batch: ResultReportBatchRecord,
  items: ResultReportDeliveryItemCreate[],
): Promise<ResultReportBatchRecord> {
  const statements = [
    db.prepare(`
      INSERT INTO phieu_batch (
        id, assignment_id, class_id, teacher_id, title, created_at, expires_at,
        view_count, is_active, request_id, quiz_id, attempt_policy,
        notify_students, create_parent_links, delivery_status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      batch.id,
      `quiz:${batch.quizId}`,
      batch.classId,
      batch.teacherId,
      batch.quizTitle,
      batch.createdAt,
      batch.expiresAt,
      batch.requestId,
      batch.quizId,
      batch.attemptPolicy,
      batch.notifyStudents ? 1 : 0,
      batch.createParentLinks ? 1 : 0,
      batch.deliveryStatus,
      batch.updatedAt,
    ),
    ...items.map((item) => db.prepare(`
      INSERT INTO result_report_delivery_items (
        id, batch_id, result_id, phieu_id, student_id, student_name,
        parent_phone, notification_id, public_link_id, student_status,
        parent_status, draft_json, attempt_count, last_error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      item.id,
      item.batchId,
      item.resultId,
      item.phieuId,
      item.studentId,
      item.studentName,
      item.parentPhone,
      item.notificationId,
      item.publicLinkId,
      item.studentStatus,
      item.parentStatus,
      JSON.stringify(item.draft),
      item.attemptCount,
      item.lastError,
      item.createdAt,
      item.updatedAt,
    )),
  ];
  await db.batch(statements);
  return batch;
}

export async function loadResultReportDeliveryItems(
  db: D1Database,
  batchId: string,
  itemIds?: string[],
): Promise<ResultReportDeliveryItemRecord[]> {
  let sql = `
    SELECT id, batch_id, result_id, phieu_id, student_id, student_name,
           parent_phone, notification_id, public_link_id, student_status,
           parent_status, draft_json, attempt_count, last_error, created_at, updated_at
    FROM result_report_delivery_items
    WHERE batch_id = ?
  `;
  const bindings: unknown[] = [batchId];
  if (itemIds && itemIds.length > 0) {
    sql += ` AND id IN (${itemIds.map(() => '?').join(',')})`;
    bindings.push(...itemIds);
  }
  sql += ' ORDER BY created_at ASC, id ASC';
  const { results } = await db.prepare(sql).bind(...bindings).all<ResultReportItemDbRow>();
  return (results ?? []).map(mapItem);
}

const ITEM_PATCH_COLUMNS: Record<string, string> = {
  phieuId: 'phieu_id',
  notificationId: 'notification_id',
  publicLinkId: 'public_link_id',
  studentStatus: 'student_status',
  parentStatus: 'parent_status',
  attemptCount: 'attempt_count',
  lastError: 'last_error',
  updatedAt: 'updated_at',
};

export async function updateResultReportDeliveryItem(
  db: D1Database,
  itemId: string,
  patch: Partial<ResultReportDeliveryItemRecord>,
): Promise<void> {
  const entries = Object.entries(patch)
    .filter(([key]) => ITEM_PATCH_COLUMNS[key]);
  if (entries.length === 0) return;
  const sets = entries.map(([key]) => `${ITEM_PATCH_COLUMNS[key]} = ?`).join(', ');
  await db.prepare(`UPDATE result_report_delivery_items SET ${sets} WHERE id = ?`)
    .bind(...entries.map(([, value]) => value), itemId)
    .run();
}

export async function updateResultReportBatchStatus(
  db: D1Database,
  batchId: string,
  status: ResultReportBatchStatus,
): Promise<void> {
  await db.prepare(`
    UPDATE phieu_batch SET delivery_status = ?, updated_at = ? WHERE id = ?
  `).bind(status, new Date().toISOString(), batchId).run();
}

export async function loadResultReportBatchDetail(
  db: D1Database,
  batch: ResultReportBatchRecord,
): Promise<ResultReportBatchDetail> {
  const { results } = await db.prepare(`
    SELECT i.*, n.is_read AS notification_read,
           l.view_count AS public_link_view_count,
           l.is_active AS public_link_active,
           l.public_token,
           r.score, r.submitted_at
    FROM result_report_delivery_items i
    LEFT JOIN notifications n ON n.id = i.notification_id
    LEFT JOIN phieu_public_links l ON l.id = i.public_link_id
    LEFT JOIN results r ON CAST(r.id AS TEXT) = i.result_id
    WHERE i.batch_id = ?
    ORDER BY i.created_at ASC, i.id ASC
  `).bind(batch.id).all<ResultReportDeliveryDetailRow>();
  return buildResultReportBatchDetail(batch, results ?? []);
}

export function buildResultReportBatchDetail(
  batch: ResultReportBatchRecord,
  rows: ResultReportDeliveryDetailRow[],
): ResultReportBatchDetail {
  const items = rows.map((row) => {
    const storedStudentStatus = row.student_status ?? (row as any).studentStatus;
    const storedParentStatus = row.parent_status ?? (row as any).parentStatus;
    const publicLinkId = row.public_link_id ?? (row as any).publicLinkId ?? null;
    const notificationId = row.notification_id ?? (row as any).notificationId ?? null;
    const linkActive = row.public_link_active;
    const studentStatus: ResultReportStudentStatus = Number(row.notification_read) === 1
      ? 'viewed'
      : storedStudentStatus;
    let parentStatus: ResultReportParentStatus = storedParentStatus;
    if (publicLinkId && Number(linkActive) === 0) parentStatus = 'revoked';
    else if (publicLinkId && Number(row.public_link_view_count) > 0) parentStatus = 'opened';
    const token = row.public_token || null;
    return {
      id: row.id,
      batchId: row.batch_id ?? (row as any).batchId,
      resultId: row.result_id ?? (row as any).resultId,
      phieuId: row.phieu_id ?? (row as any).phieuId ?? null,
      studentId: row.student_id ?? (row as any).studentId ?? null,
      studentName: row.student_name ?? (row as any).studentName,
      parentPhone: row.parent_phone ?? (row as any).parentPhone ?? null,
      notificationId,
      publicLinkId,
      publicUrl: token ? `https://${PUBLIC_PHIEU_HOST}/p/${encodeURIComponent(token)}` : null,
      studentStatus,
      parentStatus,
      attemptCount: Number(row.attempt_count ?? (row as any).attemptCount) || 0,
      lastError: row.last_error ?? (row as any).lastError ?? null,
      score: Number(row.score) || 0,
      submittedAt: row.submitted_at || '',
    };
  });
  const counts = {
    total: items.length,
    studentSent: items.filter((item) => item.studentStatus === 'sent' || item.studentStatus === 'viewed').length,
    studentViewed: items.filter((item) => item.studentStatus === 'viewed').length,
    parentLinks: items.filter((item) => ['link_created', 'opened', 'revoked'].includes(item.parentStatus)).length,
    parentOpened: items.filter((item) => item.parentStatus === 'opened').length,
    failed: items.filter((item) => item.studentStatus === 'failed' || item.parentStatus === 'failed').length,
  };
  return {
    batch: {
      id: batch.id,
      requestId: batch.requestId,
      classId: batch.classId,
      className: batch.className,
      quizId: batch.quizId,
      quizTitle: batch.quizTitle,
      attemptPolicy: batch.attemptPolicy,
      notifyStudents: batch.notifyStudents,
      createParentLinks: batch.createParentLinks,
      deliveryStatus: batch.deliveryStatus,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      counts,
    },
    items,
  };
}

export async function revokeResultReportLinks(
  db: D1Database,
  batchId: string,
  itemIds?: string[],
): Promise<number> {
  const items = await loadResultReportDeliveryItems(db, batchId, itemIds);
  let revoked = 0;
  for (const item of items) {
    if (!item.publicLinkId || item.parentStatus === 'revoked') continue;
    await db.prepare('UPDATE phieu_public_links SET is_active = 0 WHERE id = ?')
      .bind(item.publicLinkId).run();
    await updateResultReportDeliveryItem(db, item.id, {
      parentStatus: 'revoked',
      updatedAt: new Date().toISOString(),
    });
    revoked++;
  }
  return revoked;
}

export async function resolveResultReportStudentId(
  db: D1Database,
  id: string | undefined,
  username: string,
): Promise<string | null> {
  if (id) return id;
  const row = await db.prepare(`
    SELECT id FROM students WHERE username = ? AND archived_at IS NULL LIMIT 1
  `).bind(username).first<{ id: string }>();
  return row?.id || null;
}

export async function listStudentResultReports(
  db: D1Database,
  studentId: string,
): Promise<StudentResultReportSummary[]> {
  const { results } = await db.prepare(`
    SELECT p.id, i.result_id, b.quiz_id, p.ten_bai_tap AS quiz_title,
           COALESCE(t.full_name, p.created_by, '') AS teacher_name,
           p.diem_so, p.xep_loai, p.ngay_lam_bai, p.updated_at
    FROM result_report_delivery_items i
    JOIN phieu_nhanxet p ON p.id = i.phieu_id
    JOIN phieu_batch b ON b.id = i.batch_id
    LEFT JOIN teachers t ON t.username = p.created_by
    WHERE i.student_id = ? AND p.status = 'published'
    ORDER BY p.updated_at DESC, p.id DESC
  `).bind(studentId).all<any>();
  return (results ?? []).map((row: any) => ({
    id: row.id,
    resultId: String(row.result_id),
    quizId: String(row.quiz_id || ''),
    quizTitle: String(row.quiz_title || 'Bài kiểm tra'),
    teacherName: String(row.teacher_name || ''),
    score: Number(row.diem_so) || 0,
    classification: String(row.xep_loai || ''),
    submittedAt: String(row.ngay_lam_bai || ''),
    publishedAt: String(row.updated_at || ''),
  }));
}

export async function getStudentResultReport(
  db: D1Database,
  studentId: string,
  phieuId: string,
): Promise<StudentResultReportDetail | null> {
  const row = await db.prepare(`
    SELECT p.*, i.result_id, b.quiz_id,
           COALESCE(t.full_name, p.created_by, '') AS teacher_name
    FROM result_report_delivery_items i
    JOIN phieu_nhanxet p ON p.id = i.phieu_id
    JOIN phieu_batch b ON b.id = i.batch_id
    LEFT JOIN teachers t ON t.username = p.created_by
    WHERE i.student_id = ? AND p.id = ? AND p.status = 'published'
    LIMIT 1
  `).bind(studentId, phieuId).first<any>();
  if (!row) return null;
  return {
    id: row.id,
    resultId: String(row.result_id),
    quizId: String(row.quiz_id || ''),
    quizTitle: String(row.ten_bai_tap || 'Bài kiểm tra'),
    teacherName: String(row.teacher_name || ''),
    score: Number(row.diem_so) || 0,
    classification: String(row.xep_loai || ''),
    submittedAt: String(row.ngay_lam_bai || ''),
    publishedAt: String(row.updated_at || ''),
    studentName: String(row.student_name || ''),
    classId: String(row.class_id || ''),
    subject: String(row.mon_hoc || ''),
    totalQuestions: Number(row.tong_cau) || 0,
    correctCount: Number(row.so_cau_dung) || 0,
    incorrectCount: Number(row.so_cau_sai) || 0,
    comment: String(row.nhan_xet || ''),
    needsImprovement: String(row.noi_dung_co_gang || ''),
    encouragement: String(row.loi_dong_vien || ''),
  };
}
