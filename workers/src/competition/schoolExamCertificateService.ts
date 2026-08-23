import type { CreateCompetitionCertificateBatchRequest } from '../../../schemas/competition.schema';
import type { Env } from '../types';
import { persistCertificateBatch } from '../routes/certificates/batchPersistence';
import type { BatchInput, BatchScope, BatchStudent } from '../routes/certificates/batchTypes';
import { auditStatement } from '../utils/audit';
import { generateId } from '../utils/response';

interface PublicationRow {
  id: string;
  version: number;
  ranking_version: number;
}

interface PublishedWinnerRow {
  student_id: string;
  original_class_id: string;
  score: number;
  full_name: string;
}

interface CertificateRequestRow {
  id: string;
  event_id: string;
  publication_version: number;
  ranking_version: number | null;
  status: string;
  winner_count: number;
  request_id: string;
  requested_by: string;
  requested_at: string;
  error_code: string | null;
}

interface CertificateRequestMetadata {
  publication_version: number;
  ranking_version: number | null;
  template_id: string | null;
  winner_count: number;
}

interface CertificateItemRow {
  original_class_id: string;
  certificate_batch_id: string;
  winner_count: number;
}

interface CertificateChildStatusRow {
  status: 'pending' | 'processing' | 'sent' | 'partial' | 'failed';
}

function uniqueWinnerIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function canonicalBatchRequestId(input: {
  eventId: string;
  publicationVersion: number;
  rankingVersion: number;
  classId: string;
  templateId: string;
  winnerStudentIds: string[];
}): Promise<string> {
  const digest = await sha256Hex(JSON.stringify({
    eventId: input.eventId,
    publicationVersion: input.publicationVersion,
    rankingVersion: input.rankingVersion,
    classId: input.classId,
    templateId: input.templateId,
    winnerStudentIds: [...input.winnerStudentIds].sort(),
  }));
  return `competition-cert-${digest.slice(0, 48)}`;
}

function mapRequest(row: CertificateRequestRow, items: CertificateItemRow[]) {
  return {
    id: row.id,
    eventId: row.event_id,
    publicationVersion: Number(row.publication_version),
    rankingVersion: Number(row.ranking_version),
    status: row.status,
    winnerCount: Number(row.winner_count),
    batchCount: items.length,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    errorCode: row.error_code,
    batches: items.map((item) => ({
      originalClassId: item.original_class_id,
      certificateBatchId: item.certificate_batch_id,
      winnerCount: Number(item.winner_count),
    })),
  };
}

async function loadRequest(db: D1Database, eventId: string, requestId: string) {
  const row = await db.prepare(`
    SELECT id, event_id, publication_version, ranking_version, status, winner_count,
           request_id, requested_by, requested_at, error_code
    FROM competition_school_exam_certificate_batches
    WHERE event_id = ? AND request_id = ? LIMIT 1
  `).bind(eventId, requestId).first<CertificateRequestRow>();
  if (!row) return null;
  const itemsResult = await db.prepare(`
    SELECT original_class_id, certificate_batch_id, winner_count
    FROM competition_school_exam_certificate_batch_items
    WHERE parent_id = ? ORDER BY original_class_id ASC
  `).bind(row.id).all<CertificateItemRow>();
  return mapRequest(row, itemsResult.results || []);
}

async function loadRequestById(db: D1Database, eventId: string, parentId: string) {
  const row = await db.prepare(`
    SELECT id, event_id, publication_version, ranking_version, status, winner_count,
           request_id, requested_by, requested_at, error_code
    FROM competition_school_exam_certificate_batches
    WHERE event_id = ? AND id = ? LIMIT 1
  `).bind(eventId, parentId).first<CertificateRequestRow>();
  if (!row) return null;
  const itemsResult = await db.prepare(`
    SELECT original_class_id, certificate_batch_id, winner_count
    FROM competition_school_exam_certificate_batch_items
    WHERE parent_id = ? ORDER BY original_class_id ASC
  `).bind(row.id).all<CertificateItemRow>();
  return mapRequest(row, itemsResult.results || []);
}

async function loadRequestMetadata(
  db: D1Database,
  eventId: string,
  requestId: string,
): Promise<CertificateRequestMetadata | null> {
  return db.prepare(`
    SELECT publication_version, ranking_version, template_id, winner_count
    FROM competition_school_exam_certificate_batches
    WHERE event_id = ? AND request_id = ? LIMIT 1
  `).bind(eventId, requestId).first<CertificateRequestMetadata>();
}

async function markFailed(db: D1Database, parentId: string, errorCode: string): Promise<void> {
  await db.prepare(`
    UPDATE competition_school_exam_certificate_batches
    SET status = 'FAILED', error_code = ?, completed_at = ?
    WHERE id = ?
  `).bind(errorCode, new Date().toISOString(), parentId).run();
}

async function synchronizeCertificateRequestStatus(
  db: D1Database,
  certificateBatch: ReturnType<typeof mapRequest>,
) {
  if (certificateBatch.status === 'READY' || certificateBatch.status === 'FAILED') {
    return certificateBatch;
  }
  const childResult = await db.prepare(`
    SELECT child.status
    FROM competition_school_exam_certificate_batch_items AS item
    JOIN certificate_batches AS child ON child.id = item.certificate_batch_id
    WHERE item.parent_id = ?
    ORDER BY item.certificate_batch_id ASC
  `).bind(certificateBatch.id).all<CertificateChildStatusRow>();
  const children = childResult.results || [];
  if (children.length === 0) return certificateBatch;

  const hasFailure = children.some((child) => child.status === 'failed' || child.status === 'partial');
  const allSent = children.every((child) => child.status === 'sent');
  const hasProcessing = children.some((child) => child.status === 'processing');
  const status = hasFailure ? 'FAILED' : allSent ? 'READY' : hasProcessing ? 'PROCESSING' : 'QUEUED';
  if (status === certificateBatch.status) return certificateBatch;

  const completedAt = status === 'READY' || status === 'FAILED' ? new Date().toISOString() : null;
  const errorCode = status === 'FAILED' ? 'SCHOOL_EXAM_CERTIFICATE_CHILD_FAILED' : null;
  await db.prepare(`
    UPDATE competition_school_exam_certificate_batches
    SET status = ?, error_code = ?, completed_at = ?
    WHERE id = ? AND status IN ('QUEUED', 'PROCESSING')
  `).bind(status, errorCode, completedAt, certificateBatch.id).run();
  return {
    ...certificateBatch,
    status,
    errorCode,
  };
}

export async function getSchoolExamCertificateBatch(
  db: D1Database,
  eventId: string,
  parentId: string,
) {
  const certificateBatch = await loadRequestById(db, eventId, parentId);
  if (!certificateBatch) throw new Error('SCHOOL_EXAM_CERTIFICATE_NOT_FOUND');
  const publication = await db.prepare(`
    SELECT id
    FROM competition_school_exam_publications
    WHERE event_id = ? AND version = ? AND status = 'PUBLISHED'
    LIMIT 1
  `).bind(eventId, certificateBatch.publicationVersion).first<{ id: string }>();
  if (!publication) throw new Error('SCHOOL_EXAM_CERTIFICATE_PUBLICATION_NOT_FOUND');
  return synchronizeCertificateRequestStatus(db, certificateBatch);
}

function certificatePersistenceErrorCode(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'SCHOOL_EXAM_CERTIFICATE_PERSIST_FAILED';
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return 'SCHOOL_EXAM_CERTIFICATE_PERSIST_FAILED';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code ? code : 'SCHOOL_EXAM_CERTIFICATE_PERSIST_FAILED';
}

export async function createSchoolExamCertificateBatches(
  env: Env,
  input: CreateCompetitionCertificateBatchRequest,
  actorUsername: string,
) {
  const replayMetadata = await loadRequestMetadata(env.DB, input.eventId, input.requestId);
  if (replayMetadata && (
    Number(replayMetadata.publication_version) !== input.publicationVersion
    || Number(replayMetadata.ranking_version || 0) !== input.rankingVersion
    || String(replayMetadata.template_id || '') !== input.templateId
    || Number(replayMetadata.winner_count) !== uniqueWinnerIds(input.winnerStudentIds).length
  )) {
    throw new Error('SCHOOL_EXAM_CERTIFICATE_REQUEST_CONFLICT');
  }
  const replay = await loadRequest(env.DB, input.eventId, input.requestId);
  if (replay) return { created: false, certificateBatch: replay };

  const publication = await env.DB.prepare(`
    SELECT id, version, ranking_version
    FROM competition_school_exam_publications
    WHERE event_id = ? AND version = ? AND ranking_version = ? AND status = 'PUBLISHED'
    LIMIT 1
  `).bind(
    input.eventId,
    input.publicationVersion,
    input.rankingVersion,
  ).first<PublicationRow>();
  if (!publication) throw new Error('SCHOOL_EXAM_CERTIFICATE_PUBLICATION_NOT_FOUND');

  const template = await env.DB.prepare(`
    SELECT id FROM certificate_templates WHERE id = ? AND is_active = 1 LIMIT 1
  `).bind(input.templateId).first<{ id: string }>();
  if (!template) throw new Error('SCHOOL_EXAM_CERTIFICATE_TEMPLATE_NOT_FOUND');

  const winnerStudentIds = uniqueWinnerIds(input.winnerStudentIds);
  const placeholders = winnerStudentIds.map(() => '?').join(', ');
  const winnersResult = await env.DB.prepare(`
    SELECT snapshot.student_id, snapshot.original_class_id, snapshot.score, students.full_name
    FROM competition_school_exam_publication_results AS snapshot
    JOIN students ON students.id = snapshot.student_id
    WHERE snapshot.publication_id = ?
      AND snapshot.publication_version = ?
      AND snapshot.ranking_version = ?
      AND snapshot.student_id IN (${placeholders})
    ORDER BY snapshot.original_class_id ASC, snapshot.student_id ASC
  `).bind(
    publication.id,
    input.publicationVersion,
    input.rankingVersion,
    ...winnerStudentIds,
  ).all<PublishedWinnerRow>();
  const winners = winnersResult.results || [];
  if (winners.length !== winnerStudentIds.length) throw new Error('SCHOOL_EXAM_CERTIFICATE_WINNER_INVALID');

  const groups = new Map<string, PublishedWinnerRow[]>();
  for (const winner of winners) {
    const group = groups.get(winner.original_class_id) || [];
    group.push(winner);
    groups.set(winner.original_class_id, group);
  }
  if ([...groups.values()].some((group) => group.length > 100)) {
    throw new Error('SCHOOL_EXAM_CERTIFICATE_CLASS_BATCH_TOO_LARGE');
  }

  const now = new Date().toISOString();
  const parentId = generateId('school-exam-certificate');
  try {
    await env.DB.prepare(`
      INSERT INTO competition_school_exam_certificate_batches (
        id, event_id, publication_version, ranking_version, status, request_id,
        template_id, winner_count, requested_by, requested_at
      ) VALUES (?, ?, ?, ?, 'PROCESSING', ?, ?, ?, ?, ?)
    `).bind(
      parentId,
      input.eventId,
      input.publicationVersion,
      input.rankingVersion,
      input.requestId,
      input.templateId,
      winnerStudentIds.length,
      actorUsername,
      now,
    ).run();
  } catch (error) {
    const raced = await loadRequest(env.DB, input.eventId, input.requestId);
    if (raced) return { created: false, certificateBatch: raced };
    throw error;
  }

  try {
    for (const [classId, group] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      const roster: BatchStudent[] = group.map((winner) => ({ id: winner.student_id, full_name: winner.full_name }));
      const scope: BatchScope = {
        roster,
        quiz: null,
        latestResultByStudentId: new Map(group.map((winner) => [
          winner.student_id,
          { score: Number(winner.score), quiz_title: null },
        ])),
      };
      const batchInput: BatchInput = {
        title: input.title,
        requestId: await canonicalBatchRequestId({
          eventId: input.eventId,
          publicationVersion: input.publicationVersion,
          rankingVersion: input.rankingVersion,
          classId,
          templateId: input.templateId,
          winnerStudentIds: group.map((winner) => winner.student_id),
        }),
        classId,
        templateId: input.templateId,
        quizId: null,
        message: input.message ?? null,
        achievementPrefix: input.achievementPrefix ?? null,
        dateLine: input.dateLine ?? null,
        studentNameFont: input.studentNameFont ?? null,
        studentIds: roster.map((student) => student.id),
      };
      const persistedResponse = await persistCertificateBatch(env, actorUsername, batchInput, scope);
      const persistedPayload = await persistedResponse.clone().json().catch(() => null);
      if (!persistedResponse.ok) {
        const code = certificatePersistenceErrorCode(persistedPayload);
        await markFailed(env.DB, parentId, code);
        throw new Error(code);
      }
      const certificateBatchId = (persistedPayload as { data?: { batch_id?: unknown } } | null)?.data?.batch_id;
      if (typeof certificateBatchId !== 'string' || !certificateBatchId) {
        await markFailed(env.DB, parentId, 'SCHOOL_EXAM_CERTIFICATE_PERSIST_FAILED');
        throw new Error('SCHOOL_EXAM_CERTIFICATE_PERSIST_FAILED');
      }
      await env.DB.prepare(`
        INSERT OR IGNORE INTO competition_school_exam_certificate_batch_items (
          id, parent_id, event_id, publication_version, ranking_version, original_class_id,
          certificate_batch_id, winner_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        generateId('school-exam-certificate-item'),
        parentId,
        input.eventId,
        input.publicationVersion,
        input.rankingVersion,
        classId,
        certificateBatchId,
        group.length,
        now,
      ).run();
    }
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE competition_school_exam_certificate_batches
        SET status = 'QUEUED', error_code = NULL
        WHERE id = ?
      `).bind(parentId),
      auditStatement(env.DB, {
        actorUsername,
        action: 'CERTIFICATE_BATCH_CREATED',
        targetType: 'competition_school_exam_certificate_batch',
        targetId: parentId,
        requestId: input.requestId,
        after: {
          eventId: input.eventId,
          publicationVersion: input.publicationVersion,
          rankingVersion: input.rankingVersion,
          winnerCount: winnerStudentIds.length,
          batchCount: groups.size,
        },
      }),
    ]);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : '';
    const message = [
      'CERTIFICATE_QUEUE_UNAVAILABLE',
      'SCHOOL_EXAM_CERTIFICATE_PERSIST_FAILED',
    ].includes(rawMessage)
      ? rawMessage
      : 'SCHOOL_EXAM_CERTIFICATE_PERSIST_FAILED';
    await markFailed(env.DB, parentId, message);
    throw new Error(message);
  }

  const persisted = await loadRequest(env.DB, input.eventId, input.requestId);
  if (!persisted) throw new Error('SCHOOL_EXAM_CERTIFICATE_MAPPING_PERSIST_FAILED');
  return { created: true, certificateBatch: persisted };
}
