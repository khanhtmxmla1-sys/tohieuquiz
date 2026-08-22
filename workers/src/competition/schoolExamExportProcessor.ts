import writeExcelFile from 'write-excel-file/universal';
import type { Env } from '../types';
import { auditStatement } from '../utils/audit';
import { COMPETITION_XLSX_MIME } from './schoolExamExportService';

const MAX_QUEUE_ATTEMPTS = 3;
const PROCESSING_STALE_AFTER_MS = 10 * 60 * 1000;

async function sha256Hex(value: string | ArrayBuffer | ArrayBufferView): Promise<string> {
  const input = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', input as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

type ExportScope = 'SCHOOL' | 'CLASS';
type ExportStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';

export interface CompetitionExportQueueMessage {
  exportId: string;
}

interface ExportRow {
  id: string;
  event_id: string;
  publication_version: number;
  scope: ExportScope;
  class_id: string | null;
  status: ExportStatus;
  request_id: string;
  artifact_key: string | null;
  error_code: string | null;
  requested_by: string;
  requested_at: string;
  completed_at: string | null;
  attempt_count: number;
  processing_started_at: string | null;
  updated_at: string | null;
}

interface ExportContextRow {
  event_id: string;
  campaign_id: string;
  eligibility_snapshot_version: number;
  event_title: string;
  exam_date: string;
  publication_id: string;
  publication_version: number;
  ranking_version: number | null;
  result_digest: string;
  published_at: string | null;
}

interface PublishedResultRow {
  student_id: string;
  full_name: string;
  original_class_id: string;
  class_name: string | null;
  grade_level: number;
  score: number;
  correct_count: number | null;
  time_taken: number | null;
  rank_event: number;
  rank_grade: number;
  rank_class: number;
  qualified: number | null;
  eligibility_reason_codes: string | null;
}

interface RoundExportRow {
  student_id: string;
  full_name: string;
  original_class_id: string;
  class_name: string | null;
  grade_level: number;
  round_number: number;
  round_status: string;
  attempts_used: number | null;
  best_score: number | null;
  is_passed: number | null;
  progress_status: string | null;
}

interface SchoolExamExportRow extends PublishedResultRow {
  room_id: string | null;
  room_name: string | null;
  room_code: string | null;
  scheduled_at: string | null;
  form_code: string | null;
  form_definition_json: string | null;
  room_status: string | null;
  equivalent_form_approved_by: string | null;
  equivalent_form_approved_at: string | null;
  retest_status: string | null;
  retest_resolution: string | null;
}

async function exportById(db: D1Database, exportId: string): Promise<ExportRow | null> {
  return db.prepare(`
    SELECT id, event_id, publication_version, scope, class_id, status, request_id,
           artifact_key, error_code, requested_by, requested_at, completed_at,
           attempt_count, processing_started_at, updated_at
    FROM competition_school_exam_exports
    WHERE id = ? LIMIT 1
  `).bind(exportId).first<ExportRow>();
}

async function loadExportContext(db: D1Database, row: ExportRow): Promise<ExportContextRow> {
  const context = await db.prepare(`
    SELECT events.id AS event_id, events.campaign_id, events.eligibility_snapshot_version,
           events.title AS event_title, events.exam_date,
           publications.id AS publication_id, publications.version AS publication_version,
           publications.ranking_version, publications.result_digest, publications.published_at
    FROM competition_school_exam_events AS events
    JOIN competition_school_exam_publications AS publications
      ON publications.event_id = events.id
     AND publications.version = ?
     AND publications.status = 'PUBLISHED'
    WHERE events.id = ? LIMIT 1
  `).bind(row.publication_version, row.event_id).first<ExportContextRow>();
  if (!context) throw new Error('SCHOOL_EXAM_EXPORT_PUBLICATION_NOT_FOUND');
  return context;
}

async function publishedRows(
  db: D1Database,
  context: ExportContextRow,
  classId: string | null,
): Promise<PublishedResultRow[]> {
  const result = await db.prepare(`
    SELECT publication.student_id, students.full_name, publication.original_class_id,
           classes.name AS class_name, publication.grade_level, publication.score,
           publication.correct_count, publication.time_taken, publication.rank_event,
           publication.rank_grade, publication.rank_class, eligibility.qualified,
           eligibility.reason_codes_json AS eligibility_reason_codes
    FROM competition_school_exam_publication_results AS publication
    JOIN students ON students.id = publication.student_id
    LEFT JOIN classes ON classes.id = publication.original_class_id
    LEFT JOIN competition_eligibility AS eligibility
      ON eligibility.campaign_id = ?
     AND eligibility.eligibility_snapshot_version = ?
     AND eligibility.student_id = publication.student_id
    WHERE publication.publication_id = ?
      AND (? IS NULL OR publication.original_class_id = ?)
    ORDER BY publication.rank_event ASC, publication.student_id ASC
  `).bind(
    context.campaign_id,
    context.eligibility_snapshot_version,
    context.publication_id,
    classId,
    classId,
  ).all<PublishedResultRow>();
  return result.results || [];
}

async function roundRows(
  db: D1Database,
  context: ExportContextRow,
  classId: string | null,
  roundNumber: number,
): Promise<RoundExportRow[]> {
  const result = await db.prepare(`
    SELECT publication.student_id, students.full_name, publication.original_class_id,
           classes.name AS class_name, publication.grade_level,
           rounds.round_number, rounds.status AS round_status,
           progress.attempts_used, progress.best_score, progress.is_passed,
           progress.status AS progress_status
    FROM competition_school_exam_publication_results AS publication
    JOIN students ON students.id = publication.student_id
    LEFT JOIN classes ON classes.id = publication.original_class_id
    JOIN competition_rounds AS rounds
      ON rounds.campaign_id = ? AND rounds.round_number = ? AND rounds.status = 'FINALIZED'
    LEFT JOIN competition_round_progress AS progress
      ON progress.campaign_id = ?
     AND progress.round_id = rounds.id
     AND progress.student_id = publication.student_id
    WHERE publication.publication_id = ?
      AND (? IS NULL OR publication.original_class_id = ?)
    ORDER BY publication.original_class_id ASC, students.full_name ASC, publication.student_id ASC
  `).bind(
    context.campaign_id,
    roundNumber,
    context.campaign_id,
    context.publication_id,
    classId,
    classId,
  ).all<RoundExportRow>();
  return result.results || [];
}

async function schoolExamRows(
  db: D1Database,
  context: ExportContextRow,
  classId: string | null,
): Promise<SchoolExamExportRow[]> {
  const result = await db.prepare(`
    SELECT publication.student_id, students.full_name, publication.original_class_id,
           classes.name AS class_name, publication.grade_level, publication.score,
           publication.correct_count, publication.time_taken, publication.rank_event,
           publication.rank_grade, publication.rank_class, eligibility.qualified,
           members.room_id, rooms.name AS room_name, rooms.room_code, rooms.scheduled_at,
           rooms.form_code, rooms.form_definition_json, rooms.status AS room_status,
           rooms.equivalent_form_approved_by, rooms.equivalent_form_approved_at,
           retests.status AS retest_status, retests.resolution AS retest_resolution
    FROM competition_school_exam_publication_results AS publication
    JOIN students ON students.id = publication.student_id
    LEFT JOIN classes ON classes.id = publication.original_class_id
    LEFT JOIN competition_eligibility AS eligibility
      ON eligibility.campaign_id = ?
     AND eligibility.eligibility_snapshot_version = ?
     AND eligibility.student_id = publication.student_id
    LEFT JOIN competition_school_exam_members AS members
      ON members.event_id = ? AND members.student_id = publication.student_id
    LEFT JOIN competition_school_exam_rooms AS rooms ON rooms.id = members.room_id
    LEFT JOIN competition_school_exam_retests AS retests
      ON retests.id = (
        SELECT latest_retest.id
        FROM competition_school_exam_retests AS latest_retest
        WHERE latest_retest.event_id = ? AND latest_retest.student_id = publication.student_id
        ORDER BY latest_retest.requested_at DESC, latest_retest.id DESC LIMIT 1
      )
    WHERE publication.publication_id = ?
      AND (? IS NULL OR publication.original_class_id = ?)
    ORDER BY publication.rank_event ASC, publication.student_id ASC
  `).bind(
    context.campaign_id,
    context.eligibility_snapshot_version,
    context.event_id,
    context.event_id,
    context.publication_id,
    classId,
    classId,
  ).all<SchoolExamExportRow>();
  return result.results || [];
}

function yesNo(value: number | null): string {
  if (value === null) return '';
  return Number(value) === 1 ? 'Có' : 'Không';
}

function summarySheet(rows: PublishedResultRow[]) {
  return [
    ['student_id', 'ho_ten', 'lop_goc', 'ten_lop', 'khoi', 'du_dieu_kien', 'ly_do_du_dieu_kien', 'diem_thi_cap_truong', 'so_cau_dung', 'thoi_gian_giay', 'hang_toan_truong', 'hang_khoi', 'hang_lop'],
    ...rows.map((row) => [
      row.student_id,
      row.full_name,
      row.original_class_id,
      row.class_name || '',
      Number(row.grade_level),
      yesNo(row.qualified),
      row.eligibility_reason_codes || '',
      Number(row.score),
      row.correct_count === null ? '' : Number(row.correct_count),
      row.time_taken === null ? '' : Number(row.time_taken),
      Number(row.rank_event),
      Number(row.rank_grade),
      Number(row.rank_class),
    ]),
  ];
}

function roundSheet(rows: RoundExportRow[]) {
  return [
    ['student_id', 'ho_ten', 'lop_goc', 'ten_lop', 'khoi', 'vong', 'trang_thai_vong', 'so_lan_lam', 'diem_tot_nhat', 'dat', 'trang_thai_tien_do'],
    ...rows.map((row) => [
      row.student_id,
      row.full_name,
      row.original_class_id,
      row.class_name || '',
      Number(row.grade_level),
      Number(row.round_number || 0),
      row.round_status || '',
      row.attempts_used === null ? '' : Number(row.attempts_used),
      row.best_score === null ? '' : Number(row.best_score),
      yesNo(row.is_passed),
      row.progress_status || '',
    ]),
  ];
}

function schoolExamSheet(rows: SchoolExamExportRow[]) {
  return [
    ['student_id', 'ho_ten', 'lop_goc', 'ten_lop', 'khoi', 'phong_thi', 'ma_phong', 'ca_thi', 'ma_de', 'dinh_nghia_de', 'trang_thai_phong', 'nguoi_duyet_de_tuong_duong', 'luc_duyet_de_tuong_duong', 'diem', 'so_cau_dung', 'thoi_gian_giay', 'hang_toan_truong', 'hang_khoi', 'hang_lop', 'retest_status', 'retest_resolution'],
    ...rows.map((row) => [
      row.student_id,
      row.full_name,
      row.original_class_id,
      row.class_name || '',
      Number(row.grade_level),
      row.room_name || '',
      row.room_code || '',
      row.scheduled_at || '',
      row.form_code || '',
      row.form_definition_json || '',
      row.room_status || '',
      row.equivalent_form_approved_by || '',
      row.equivalent_form_approved_at || '',
      Number(row.score),
      row.correct_count === null ? '' : Number(row.correct_count),
      row.time_taken === null ? '' : Number(row.time_taken),
      Number(row.rank_event),
      Number(row.rank_grade),
      Number(row.rank_class),
      row.retest_status || '',
      row.retest_resolution || '',
    ]),
  ];
}

async function buildWorkbook(env: Env, row: ExportRow): Promise<Blob> {
  const context = await loadExportContext(env.DB, row);
  const classId = row.scope === 'CLASS' ? row.class_id : null;
  const summary = await publishedRows(env.DB, context, classId);
  if (summary.length === 0) throw new Error('SCHOOL_EXAM_EXPORT_EMPTY_SCOPE');
  const rounds = await Promise.all(
    Array.from({ length: 6 }, (_, index) => roundRows(env.DB, context, classId, index + 1)),
  );
  const schoolExam = await schoolExamRows(env.DB, context, classId);
  const metadata = [
    ['key', 'value'],
    ['event_id', context.event_id],
    ['campaign_id', context.campaign_id],
    ['event_title', context.event_title],
    ['exam_date', context.exam_date],
    ['eligibility_snapshot_version', Number(context.eligibility_snapshot_version)],
    ['publication_version', Number(context.publication_version)],
    ['ranking_version', Number(context.ranking_version || context.publication_version)],
    ['result_digest', context.result_digest],
    ['published_at', context.published_at || ''],
    ['export_id', row.id],
    ['scope', row.scope],
    ['class_id', row.class_id || ''],
    ['generated_at', new Date().toISOString()],
  ];

  return writeExcelFile([
    { data: summarySheet(summary), sheet: 'Tong_hop' },
    ...rounds.map((items, index) => ({ data: roundSheet(items), sheet: `Vong_${index + 1}` })),
    { data: schoolExamSheet(schoolExam), sheet: 'Thi_cap_truong' },
    { data: metadata, sheet: 'Metadata' },
  ]).toBlob();
}

function retryDelaySeconds(attempt: number): number {
  return Math.min(300, 30 * (2 ** Math.max(0, attempt - 1)));
}

async function markRetryableFailure(db: D1Database, exportId: string, now: string): Promise<void> {
  await db.prepare(`
    UPDATE competition_school_exam_exports
    SET status = 'QUEUED', error_code = 'SCHOOL_EXAM_EXPORT_GENERATION_FAILED',
        processing_started_at = NULL, updated_at = ?
    WHERE id = ?
  `).bind(now, exportId).run();
}

async function markTerminalFailure(db: D1Database, exportId: string, now: string): Promise<void> {
  await db.prepare(`
    UPDATE competition_school_exam_exports
    SET status = 'FAILED', error_code = 'SCHOOL_EXAM_EXPORT_GENERATION_FAILED',
        processing_started_at = NULL, completed_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(now, now, exportId).run();
}

export async function processCompetitionExportQueue(
  batch: MessageBatch<CompetitionExportQueueMessage>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    const exportId = String(message.body?.exportId || '').trim();
    if (!exportId) {
      message.ack();
      continue;
    }

    const row = await exportById(env.DB, exportId);
    if (!row) {
      message.ack();
      continue;
    }
    if (row.status === 'READY' || row.status === 'FAILED') {
      message.ack();
      continue;
    }

    if (row.status === 'PROCESSING' && row.processing_started_at) {
      const age = Date.now() - Date.parse(row.processing_started_at);
      if (Number.isFinite(age) && age < PROCESSING_STALE_AFTER_MS) {
        message.retry({ delaySeconds: 60 });
        continue;
      }
    }

    const startedAt = new Date().toISOString();
    try {
      if (!env.COMPETITION_EXPORTS) throw new Error('SCHOOL_EXAM_EXPORT_STORAGE_UNAVAILABLE');
      await env.DB.prepare(`
        UPDATE competition_school_exam_exports
        SET status = 'PROCESSING', attempt_count = attempt_count + 1,
            processing_started_at = ?, error_code = NULL, updated_at = ?
        WHERE id = ?
      `).bind(startedAt, startedAt, exportId).run();

      const fresh = await exportById(env.DB, exportId);
      if (!fresh) throw new Error('SCHOOL_EXAM_EXPORT_NOT_FOUND');
      const workbook = await buildWorkbook(env, fresh);
      const workbookBytes = new Uint8Array(await workbook.arrayBuffer());
      if (workbookBytes[0] !== 0x50 || workbookBytes[1] !== 0x4b) {
        throw new Error('SCHOOL_EXAM_EXPORT_INVALID_XLSX');
      }
      const artifactKey = `competition/exports/${fresh.event_id}/${fresh.id}.xlsx`;
      await env.COMPETITION_EXPORTS.put(artifactKey, workbook, {
        httpMetadata: {
          contentType: COMPETITION_XLSX_MIME,
          contentDisposition: `attachment; filename="competition-${fresh.event_id}-${fresh.id}.xlsx"`,
        },
      });
      const persistedArtifact = await env.COMPETITION_EXPORTS.get(artifactKey);
      if (!persistedArtifact) throw new Error('SCHOOL_EXAM_EXPORT_ARTIFACT_NOT_FOUND');
      if (persistedArtifact.httpMetadata?.contentType !== COMPETITION_XLSX_MIME) {
        throw new Error('SCHOOL_EXAM_EXPORT_INVALID_MIME');
      }
      if (Number(persistedArtifact.size) !== workbookBytes.byteLength) {
        throw new Error('SCHOOL_EXAM_EXPORT_ARTIFACT_SIZE_MISMATCH');
      }
      const persistedBytes = new Uint8Array(await persistedArtifact.arrayBuffer());
      if (persistedBytes[0] !== 0x50 || persistedBytes[1] !== 0x4b) {
        throw new Error('SCHOOL_EXAM_EXPORT_INVALID_XLSX');
      }
      const artifactSha256 = await sha256Hex(persistedBytes);
      const generatedSha256 = await sha256Hex(workbookBytes);
      if (artifactSha256 !== generatedSha256) {
        throw new Error('SCHOOL_EXAM_EXPORT_ARTIFACT_CHECKSUM_MISMATCH');
      }
      const completedAt = new Date().toISOString();
      const artifactKeyHash = await sha256Hex(artifactKey);
      await env.DB.batch([
        env.DB.prepare(`
          UPDATE competition_school_exam_exports
          SET status = 'READY', artifact_key = ?, error_code = NULL,
              processing_started_at = NULL, completed_at = ?, updated_at = ?
          WHERE id = ?
        `).bind(artifactKey, completedAt, completedAt, exportId),
        auditStatement(env.DB, {
          actorUsername: fresh.requested_by,
          action: 'XLSX_EXPORTED',
          targetType: 'competition_school_exam_export',
          targetId: exportId,
          requestId: fresh.request_id,
          after: {
            eventId: fresh.event_id,
            publicationVersion: fresh.publication_version,
            scope: fresh.scope,
            classId: fresh.class_id,
            artifactKeyHash,
            artifactMime: persistedArtifact.httpMetadata.contentType,
            artifactSizeBytes: persistedBytes.byteLength,
            artifactSha256,
          },
        }),
      ]);
      message.ack();
    } catch {
      const failedAt = new Date().toISOString();
      if (Number(message.attempts || 1) < MAX_QUEUE_ATTEMPTS) {
        await markRetryableFailure(env.DB, exportId, failedAt).catch(() => undefined);
        message.retry({ delaySeconds: retryDelaySeconds(Number(message.attempts || 1)) });
      } else {
        await markTerminalFailure(env.DB, exportId, failedAt).catch(() => undefined);
        message.ack();
      }
    }
  }
}
