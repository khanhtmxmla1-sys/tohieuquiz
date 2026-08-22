import type { Env } from '../types';
import { auditStatement } from '../utils/audit';
import { generateId } from '../utils/response';

export const COMPETITION_XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type ExportScope = 'SCHOOL' | 'CLASS';
type ExportStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';

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

interface PublicationRow {
  id: string;
  event_id: string;
  version: number;
  ranking_version: number | null;
  result_digest: string;
  published_at: string | null;
}

function mapExport(row: ExportRow) {
  return {
    id: row.id,
    eventId: row.event_id,
    publicationVersion: Number(row.publication_version),
    scope: row.scope,
    classId: row.class_id,
    status: row.status,
    requestId: row.request_id,
    artifactKey: row.artifact_key,
    errorCode: row.error_code,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
    attemptCount: Number(row.attempt_count || 0),
  };
}

async function exportRow(db: D1Database, eventId: string, exportId: string): Promise<ExportRow | null> {
  return db.prepare(`
    SELECT id, event_id, publication_version, scope, class_id, status, request_id,
           artifact_key, error_code, requested_by, requested_at, completed_at,
           attempt_count, processing_started_at, updated_at
    FROM competition_school_exam_exports
    WHERE event_id = ? AND id = ? LIMIT 1
  `).bind(eventId, exportId).first<ExportRow>();
}

async function exportByRequest(db: D1Database, eventId: string, requestId: string): Promise<ExportRow | null> {
  return db.prepare(`
    SELECT id, event_id, publication_version, scope, class_id, status, request_id,
           artifact_key, error_code, requested_by, requested_at, completed_at,
           attempt_count, processing_started_at, updated_at
    FROM competition_school_exam_exports
    WHERE event_id = ? AND request_id = ? LIMIT 1
  `).bind(eventId, requestId).first<ExportRow>();
}

async function latestPublished(db: D1Database, eventId: string): Promise<PublicationRow | null> {
  return db.prepare(`
    SELECT id, event_id, version, ranking_version, result_digest, published_at
    FROM competition_school_exam_publications
    WHERE event_id = ? AND status = 'PUBLISHED'
    ORDER BY version DESC LIMIT 1
  `).bind(eventId).first<PublicationRow>();
}

async function ownsClass(db: D1Database, username: string, classId: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT id FROM classes
    WHERE id = ? AND teacher_username = ? AND COALESCE(archived_at, '') = '' LIMIT 1
  `).bind(classId, username).first<{ id: string }>();
  return Boolean(row);
}

async function authorizeExport(
  db: D1Database,
  row: Pick<ExportRow, 'scope' | 'class_id'>,
  actor: { username: string; role: string },
): Promise<void> {
  if (actor.role === 'admin') return;
  if (row.scope !== 'CLASS' || !row.class_id) throw new Error('SCHOOL_EXAM_EXPORT_FORBIDDEN');
  if (!await ownsClass(db, actor.username, row.class_id)) throw new Error('SCHOOL_EXAM_EXPORT_FORBIDDEN');
}

async function ensureClassInPublication(
  db: D1Database,
  publicationId: string,
  classId: string,
): Promise<void> {
  const row = await db.prepare(`
    SELECT 1 AS found FROM competition_school_exam_publication_results
    WHERE publication_id = ? AND original_class_id = ? LIMIT 1
  `).bind(publicationId, classId).first<{ found: number }>();
  if (!row) throw new Error('SCHOOL_EXAM_EXPORT_CLASS_NOT_IN_PUBLICATION');
}

export async function createSchoolExamExport(
  env: Env,
  input: { eventId: string; scope: ExportScope; classId?: string; requestId: string },
  actor: { username: string; role: string },
) {
  const replay = await exportByRequest(env.DB, input.eventId, input.requestId);
  if (replay) {
    await authorizeExport(env.DB, replay, actor);
    return { export: mapExport(replay), created: false };
  }

  if (!env.COMPETITION_EXPORT_QUEUE) throw new Error('SCHOOL_EXAM_EXPORT_QUEUE_UNAVAILABLE');
  const publication = await latestPublished(env.DB, input.eventId);
  if (!publication) throw new Error('SCHOOL_EXAM_EXPORT_PUBLICATION_NOT_FOUND');

  const classId = input.scope === 'CLASS' ? String(input.classId || '').trim() : null;
  const pendingAuth = { scope: input.scope, class_id: classId };
  await authorizeExport(env.DB, pendingAuth, actor);
  if (classId) await ensureClassInPublication(env.DB, publication.id, classId);

  const id = generateId('school-exam-export');
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO competition_school_exam_exports (
        id, event_id, publication_version, scope, class_id, status, request_id,
        artifact_key, error_code, requested_by, requested_at, completed_at,
        attempt_count, processing_started_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'QUEUED', ?, NULL, NULL, ?, ?, NULL, 0, NULL, ?)
    `).bind(
      id,
      input.eventId,
      Number(publication.version),
      input.scope,
      classId,
      input.requestId,
      actor.username,
      now,
      now,
    ),
    auditStatement(env.DB, {
      actorUsername: actor.username,
      action: 'XLSX_EXPORT_REQUESTED',
      targetType: 'competition_school_exam_export',
      targetId: id,
      requestId: input.requestId,
      after: {
        eventId: input.eventId,
        publicationVersion: Number(publication.version),
        scope: input.scope,
        classId,
      },
    }),
  ]);

  try {
    await env.COMPETITION_EXPORT_QUEUE.send({ exportId: id });
  } catch {
    await env.DB.prepare(`
      UPDATE competition_school_exam_exports
      SET status = 'FAILED', error_code = 'SCHOOL_EXAM_EXPORT_QUEUE_FAILED',
          completed_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(now, now, id).run();
    throw new Error('SCHOOL_EXAM_EXPORT_QUEUE_FAILED');
  }

  const created = await exportRow(env.DB, input.eventId, id);
  if (!created) throw new Error('SCHOOL_EXAM_EXPORT_PERSIST_FAILED');
  return { export: mapExport(created), created: true };
}

export async function getSchoolExamExport(
  db: D1Database,
  eventId: string,
  exportId: string,
  actor: { username: string; role: string },
) {
  const row = await exportRow(db, eventId, exportId);
  if (!row) throw new Error('SCHOOL_EXAM_EXPORT_NOT_FOUND');
  await authorizeExport(db, row, actor);
  return mapExport(row);
}

export async function downloadSchoolExamExport(
  env: Env,
  eventId: string,
  exportId: string,
  actor: { username: string; role: string },
): Promise<Response> {
  const row = await exportRow(env.DB, eventId, exportId);
  if (!row) throw new Error('SCHOOL_EXAM_EXPORT_NOT_FOUND');
  await authorizeExport(env.DB, row, actor);
  if (row.status !== 'READY' || !row.artifact_key) throw new Error('SCHOOL_EXAM_EXPORT_NOT_READY');
  if (!env.COMPETITION_EXPORTS) throw new Error('SCHOOL_EXAM_EXPORT_STORAGE_UNAVAILABLE');

  let object: R2ObjectBody | null;
  try {
    object = await env.COMPETITION_EXPORTS.get(row.artifact_key);
  } catch {
    throw new Error('SCHOOL_EXAM_EXPORT_STORAGE_UNAVAILABLE');
  }
  if (!object) throw new Error('SCHOOL_EXAM_EXPORT_ARTIFACT_NOT_FOUND');

  const safeEventId = eventId.replace(/[^A-Za-z0-9_-]+/g, '-');
  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': COMPETITION_XLSX_MIME,
      'Content-Disposition': `attachment; filename="competition-${safeEventId}-${exportId}.xlsx"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
