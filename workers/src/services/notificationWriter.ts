import {
  isNotificationPriority,
  isNotificationType,
  isSafeNotificationActionUrl,
  type NotificationPriority,
  type NotificationType,
} from '../../../shared/notifications.contract';

export type NotificationRecipientRole = 'student' | 'teacher' | 'admin';

export interface CreateNotificationInput {
  id?: string;
  userId: string;
  userRole: NotificationRecipientRole;
  type: NotificationType;
  title: string;
  body?: string | null;
  priority?: NotificationPriority;
  actionUrl?: string | null;
  data?: Record<string, unknown>;
  sourceType?: string | null;
  sourceId?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
}

interface NormalizedNotification {
  id: string;
  userId: string;
  userRole: NotificationRecipientRole;
  type: NotificationType;
  title: string;
  body: string | null;
  dataJson: string;
  priority: NotificationPriority;
  sourceType: string | null;
  sourceId: string | null;
  actionUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const RECIPIENT_ROLES = new Set<NotificationRecipientRole>([
  'student',
  'teacher',
  'admin',
]);

function requiredText(value: unknown, field: string, maxLength: number): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} must be between 1 and ${maxLength} characters`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, field, maxLength);
}

function validIsoDate(value: string | null, field: string): string | null {
  if (value === null) return null;
  if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid date`);
  return value;
}

function normalizeInput(input: CreateNotificationInput): NormalizedNotification {
  if (!RECIPIENT_ROLES.has(input.userRole)) {
    throw new Error('userRole is invalid');
  }
  if (!isNotificationType(input.type)) {
    throw new Error('notification type is invalid');
  }

  const priority = input.priority ?? 'INFO';
  if (!isNotificationPriority(priority)) {
    throw new Error('notification priority is invalid');
  }

  const actionUrl = input.actionUrl ?? null;
  if (actionUrl !== null && !isSafeNotificationActionUrl(actionUrl)) {
    throw new Error('notification action URL is invalid');
  }

  const sourceType = optionalText(input.sourceType, 'sourceType', 100);
  const sourceId = optionalText(input.sourceId, 'sourceId', 200);
  if (Boolean(sourceType) !== Boolean(sourceId)) {
    throw new Error('sourceType and sourceId must be provided together');
  }

  let dataJson: string;
  try {
    dataJson = JSON.stringify(input.data ?? {});
  } catch {
    throw new Error('notification payload must be JSON serializable');
  }
  if (!dataJson || dataJson.length > 32_000) {
    throw new Error('notification payload is invalid or too large');
  }

  return {
    id: optionalText(input.id, 'id', 200) ?? `ntf-${crypto.randomUUID()}`,
    userId: requiredText(input.userId, 'userId', 200),
    userRole: input.userRole,
    type: input.type,
    title: requiredText(input.title, 'title', 240),
    body: optionalText(input.body, 'body', 4_000),
    dataJson,
    priority,
    sourceType,
    sourceId,
    actionUrl,
    expiresAt: validIsoDate(optionalText(input.expiresAt, 'expiresAt', 50), 'expiresAt'),
    createdAt: validIsoDate(
      optionalText(input.createdAt, 'createdAt', 50) ?? new Date().toISOString(),
      'createdAt',
    ) as string,
  };
}

function prepareInsert(db: D1Database, input: CreateNotificationInput): D1PreparedStatement {
  const item = normalizeInput(input);
  return db.prepare(`
    INSERT OR IGNORE INTO notifications (
      id, user_id, user_role, type, title, body, data, priority,
      source_type, source_id, action_url, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    item.id,
    item.userId,
    item.userRole,
    item.type,
    item.title,
    item.body,
    item.dataJson,
    item.priority,
    item.sourceType,
    item.sourceId,
    item.actionUrl,
    item.expiresAt,
    item.createdAt,
  );
}

export async function createNotification(
  db: D1Database,
  input: CreateNotificationInput,
): Promise<'created' | 'duplicate'> {
  const result = await prepareInsert(db, input).run();
  return Number(result.meta?.changes || 0) > 0 ? 'created' : 'duplicate';
}

export async function createNotifications(
  db: D1Database,
  inputs: CreateNotificationInput[],
): Promise<{ created: number; duplicate: number }> {
  if (inputs.length === 0) return { created: 0, duplicate: 0 };
  const results = await db.batch(inputs.map((input) => prepareInsert(db, input)));
  const created = results.reduce(
    (count, result) => count + (Number(result.meta?.changes || 0) > 0 ? 1 : 0),
    0,
  );
  return { created, duplicate: inputs.length - created };
}
