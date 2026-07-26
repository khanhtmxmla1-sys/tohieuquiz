import type { ParentNotificationKind } from '../../../shared/parent-portal.contract';
import {
  parentPortalLogger,
  type ParentPortalEventLogger,
} from './observability';

const BLOCKED_PAYLOAD_KEYS = new Set([
  'answers',
  'correct_answer',
  'correctAnswer',
  'selected_answer',
  'selectedAnswer',
]);

export interface CreateParentNotificationInput {
  studentId: string;
  kind: ParentNotificationKind;
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  isImportant?: boolean;
  publishedAt: string;
  expiresAt?: string | null;
  createdBy?: string;
}

export interface FanOutParentNotificationInput extends Omit<CreateParentNotificationInput, 'studentId'> {
  classId: string;
}

const sanitizePayload = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizePayload);
  if (!value || typeof value !== 'object') return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (BLOCKED_PAYLOAD_KEYS.has(key)) continue;
    output[key] = sanitizePayload(item);
  }
  return output;
};

export async function createParentNotification(
  db: D1Database,
  input: CreateParentNotificationInput,
  logger: ParentPortalEventLogger = parentPortalLogger,
): Promise<{ id: string; created: boolean }> {
  const id = `pn-${crypto.randomUUID()}`;
  const result = await db.prepare(`
    INSERT OR IGNORE INTO parent_notifications (
      id, student_id, kind, source_type, source_id, title, body,
      payload_json, is_important, published_at, expires_at, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    input.studentId,
    input.kind,
    input.sourceType,
    input.sourceId,
    input.title.slice(0, 160),
    input.body.slice(0, 2000),
    JSON.stringify(sanitizePayload(input.payload || {})),
    input.isImportant ? 1 : 0,
    input.publishedAt,
    input.expiresAt || null,
    input.createdBy || 'system',
    input.publishedAt,
  ).run();
  const created = Number(result?.meta?.changes || 0) === 1;
  if (created) logger.info('notification_created', {
    notificationId: id,
    kind: input.kind,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    studentId: input.studentId,
  });
  return { id, created };
}

export async function fanOutParentNotificationToClass(
  db: D1Database,
  input: FanOutParentNotificationInput,
): Promise<{ targetCount: number; createdCount: number }> {
  const rows = await db.prepare(`
    SELECT id
    FROM students
    WHERE class_id = ? AND COALESCE(archived_at, '') = ''
    ORDER BY id
  `).bind(input.classId).all<{ id: string }>();

  let createdCount = 0;
  for (const student of rows.results) {
    const result = await createParentNotification(db, {
      studentId: student.id,
      kind: input.kind,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      title: input.title,
      body: input.body,
      payload: input.payload,
      isImportant: input.isImportant,
      publishedAt: input.publishedAt,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy,
    });
    if (result.created) createdCount += 1;
  }
  return { targetCount: rows.results.length, createdCount };
}
