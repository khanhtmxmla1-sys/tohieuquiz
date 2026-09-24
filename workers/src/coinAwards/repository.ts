import type {
  CoinAwardBatchKind,
  CoinAwardHistoryEntry,
  CoinAwardHistoryPage,
  CoinAwardReceipt,
  CoinAwardSettings,
} from '../../../shared/coin-awards.contract';
import { getSystemDateKey } from '../utils/systemTime';
import { decodeHistoryCursor, encodeHistoryCursor, domainError } from './validation';

export type CoinAwardActor = {
  username: string;
  displayName: string;
  role: 'teacher' | 'admin';
};

export interface CoinAwardStudent {
  id: string;
  username: string;
  fullName: string;
  classId: string;
  className: string;
  teacherUsername: string;
  coins: number;
  archivedAt: string | null;
  originalLedgerId?: string;
}

export interface CoinAwardClass {
  id: string;
  name: string;
  teacherUsername: string;
  archivedAt: string | null;
}

export interface CoinAwardBatchRow {
  id: string;
  kind: CoinAwardBatchKind;
  parent_batch_id: string | null;
  actor_username: string;
  actor_display_name: string;
  actor_role: 'teacher' | 'admin';
  selection_mode: 'STUDENT' | 'SELECTED' | 'CLASS';
  class_id: string | null;
  class_name: string | null;
  coins_per_student: number;
  recipient_count: number;
  total_coins: number;
  reason: string;
  idempotency_key: string;
  request_hash: string;
  hanoi_date: string;
  reversal_expires_at: string | null;
  created_at: string;
}

export interface CoinAwardScope {
  classroom: CoinAwardClass | null;
  recipients: CoinAwardStudent[];
}

export interface CoinAwardSettingsRow {
  scope_key: 'school';
  max_coins_per_student: number;
  max_teacher_daily_coins: number;
  reversal_window_minutes: number;
  updated_by: string;
  updated_at: string;
}

const rowToSettings = (row: CoinAwardSettingsRow): CoinAwardSettings => ({
  scopeKey: 'school',
  maxCoinsPerStudent: Number(row.max_coins_per_student),
  maxTeacherDailyCoins: Number(row.max_teacher_daily_coins),
  reversalWindowMinutes: Number(row.reversal_window_minutes),
  updatedBy: String(row.updated_by),
  updatedAt: String(row.updated_at),
});

export const getCoinAwardSettings = async (db: D1Database): Promise<CoinAwardSettings> => {
  const row = await db.prepare(`
    SELECT scope_key, max_coins_per_student, max_teacher_daily_coins,
           reversal_window_minutes, updated_by, updated_at
    FROM coin_award_settings WHERE scope_key = 'school' LIMIT 1
  `).first<CoinAwardSettingsRow>();
  if (!row) throw domainError('SETTINGS_NOT_FOUND', 'Coin award settings are missing');
  return rowToSettings(row);
};

export const getCoinAwardClass = async (db: D1Database, classId: string): Promise<CoinAwardClass | null> => {
  if (!classId) return null;
  return db.prepare(`
    SELECT id, name, teacher_username AS teacherUsername, archived_at AS archivedAt
    FROM classes WHERE id = ? LIMIT 1
  `).bind(classId).first<CoinAwardClass>();
};

const getStudent = async (db: D1Database, studentId: string): Promise<CoinAwardStudent | null> => (
  db.prepare(`
    SELECT s.id, s.username, s.full_name AS fullName, s.class_id AS classId,
           c.name AS className, c.teacher_username AS teacherUsername,
           s.coins, s.archived_at AS archivedAt
    FROM students s JOIN classes c ON c.id = s.class_id
    WHERE s.id = ? LIMIT 1
  `).bind(studentId).first<CoinAwardStudent>()
);

export const resolveCoinAwardScope = async (
  db: D1Database,
  actor: CoinAwardActor,
  classId: string,
  selectionMode: 'STUDENT' | 'SELECTED' | 'CLASS',
  studentIds: string[],
): Promise<CoinAwardScope> => {
  const classroom = await getCoinAwardClass(db, classId);
  if (classId && !classroom) throw domainError('UNAUTHORIZED_RECIPIENT', 'Class is not available');
  if (classroom?.archivedAt) throw domainError('UNAUTHORIZED_RECIPIENT', 'Class is archived');
  if (actor.role === 'teacher' && (!classroom || classroom.teacherUsername !== actor.username)) {
    throw domainError('UNAUTHORIZED_RECIPIENT', 'Teacher does not manage this class');
  }

  let recipients: CoinAwardStudent[];
  if (selectionMode === 'CLASS') {
    if (!classroom) throw domainError('INVALID_SELECTION', 'Class selection requires a class');
    const result = await db.prepare(`
      SELECT s.id, s.username, s.full_name AS fullName, s.class_id AS classId,
             c.name AS className, c.teacher_username AS teacherUsername,
             s.coins, s.archived_at AS archivedAt
      FROM students s JOIN classes c ON c.id = s.class_id
      WHERE s.class_id = ? AND s.archived_at IS NULL
      ORDER BY s.id
      LIMIT 101
    `).bind(classroom.id).all<CoinAwardStudent>();
    recipients = (result.results || []).map((row) => ({ ...row, coins: Number(row.coins) || 0 }));
  } else {
    const loaded = await Promise.all(studentIds.map((id) => getStudent(db, id)));
    const missing = loaded.findIndex((student) => !student);
    if (missing >= 0) throw domainError('UNAUTHORIZED_RECIPIENT', 'Recipient is not available', [studentIds[missing]]);
    recipients = loaded.filter((student): student is CoinAwardStudent => Boolean(student));
    const inactive = recipients.filter((student) => Boolean(student.archivedAt));
    if (inactive.length > 0) throw domainError('INACTIVE_RECIPIENT', 'Recipient is archived', inactive.map((student) => student.id));
  }

  if (recipients.length < 1) throw domainError('INVALID_RECIPIENT_COUNT', 'No active recipients remain');
  if (recipients.length > 100) throw domainError('INVALID_RECIPIENT_COUNT', 'Too many recipients');
  const outOfScope = recipients.filter((student) => {
    if (actor.role === 'teacher') return student.teacherUsername !== actor.username || student.classId !== classId;
    return Boolean(classId && student.classId !== classId);
  });
  if (outOfScope.length > 0) throw domainError('UNAUTHORIZED_RECIPIENT', 'Recipient is outside the requested scope', outOfScope.map((student) => student.id));
  return { classroom, recipients: recipients.sort((left, right) => left.id.localeCompare(right.id)) };
};

export const findCoinAwardBatchByIdempotency = (
  db: D1Database,
  actorUsername: string,
  idempotencyKey: string,
): Promise<CoinAwardBatchRow | null> => db.prepare(`
  SELECT * FROM coin_award_batches WHERE actor_username = ? AND idempotency_key = ? LIMIT 1
`).bind(actorUsername, idempotencyKey).first<CoinAwardBatchRow>();

export const getCoinAwardBatch = (
  db: D1Database,
  batchId: string,
): Promise<CoinAwardBatchRow | null> => db.prepare(`
  SELECT * FROM coin_award_batches WHERE id = ? LIMIT 1
`).bind(batchId).first<CoinAwardBatchRow>();

export interface CoinAwardLedgerRecipient {
  id: string;
  student_id: string;
  username: string;
  coins_delta: number;
  payload_json: string;
  created_at: string;
}

export const getCoinAwardBatchRecipients = async (
  db: D1Database,
  batchId: string,
  sourceType = 'MANUAL_AWARD',
): Promise<CoinAwardLedgerRecipient[]> => {
  const result = await db.prepare(`
    SELECT l.id, l.student_id, s.username, l.coins_delta, l.payload_json, l.created_at
    FROM student_reward_ledger l JOIN students s ON s.id = l.student_id
    WHERE l.source_type = ? AND json_extract(l.payload_json, '$.batchId') = ?
    ORDER BY l.student_id
  `).bind(sourceType, batchId).all<CoinAwardLedgerRecipient>();
  return (result.results || []).map((row) => ({ ...row, coins_delta: Number(row.coins_delta) }));
};

export const getTeacherDailyAwardTotal = async (
  db: D1Database,
  actorUsername: string,
  hanoiDate: string,
): Promise<number> => {
  const row = await db.prepare(`
    SELECT COALESCE(SUM(total_coins), 0) AS total
    FROM coin_award_batches
    WHERE actor_username = ? AND actor_role = 'teacher' AND kind = 'AWARD'
      AND hanoi_date = ? AND coins_per_student > 0
  `).bind(actorUsername, hanoiDate).first<{ total: number }>();
  return Number(row?.total || 0);
};

export const buildCoinAwardBatchInsert = (
  db: D1Database,
  row: Omit<CoinAwardBatchRow, 'parent_batch_id'> & { parent_batch_id?: string | null },
): D1PreparedStatement => db.prepare(`
  INSERT INTO coin_award_batches (
    id, kind, parent_batch_id, actor_username, actor_display_name, actor_role,
    selection_mode, class_id, class_name, coins_per_student, recipient_count,
    total_coins, reason, idempotency_key, request_hash, hanoi_date,
    reversal_expires_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).bind(
  row.id, row.kind, row.parent_batch_id ?? null, row.actor_username, row.actor_display_name,
  row.actor_role, row.selection_mode, row.class_id, row.class_name, row.coins_per_student,
  row.recipient_count, row.total_coins, row.reason, row.idempotency_key, row.request_hash,
  row.hanoi_date, row.reversal_expires_at, row.created_at,
);

export const buildCoinAwardSettingsUpdate = (
  db: D1Database,
  values: { maxCoinsPerStudent: number; maxTeacherDailyCoins: number; reversalWindowMinutes: number; updatedBy: string; expectedUpdatedAt: string; updatedAt: string },
): D1PreparedStatement => db.prepare(`
  UPDATE coin_award_settings
  SET max_coins_per_student = ?, max_teacher_daily_coins = ?, reversal_window_minutes = ?,
      updated_by = ?, updated_at = ?
  WHERE scope_key = 'school' AND updated_at = ?
`).bind(
  values.maxCoinsPerStudent, values.maxTeacherDailyCoins, values.reversalWindowMinutes,
  values.updatedBy, values.updatedAt, values.expectedUpdatedAt,
);

const mapBatchToReceipt = (row: CoinAwardBatchRow, alreadyProcessed: boolean): CoinAwardReceipt => ({
  batchId: row.id,
  kind: row.kind,
  recipientCount: Number(row.recipient_count),
  coinsPerStudent: Number(row.coins_per_student),
  totalCoins: Number(row.total_coins),
  reason: row.reason,
  actorUsername: row.actor_username,
  actorDisplayName: row.actor_display_name,
  actorRole: row.actor_role,
  classId: row.class_id,
  className: row.class_name,
  createdAt: row.created_at,
  reversalExpiresAt: row.reversal_expires_at,
  alreadyProcessed,
});

export const coinAwardReceiptFromRow = mapBatchToReceipt;

export const listStaffBatches = async (
  db: D1Database,
  actor: CoinAwardActor,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<CoinAwardHistoryPage> => {
  const requestedLimit = Number(options.limit);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.trunc(requestedLimit))) : 25;
  const cursor = decodeHistoryCursor(options.cursor);
  const where = actor.role === 'admin'
    ? '1 = 1'
    : 'c.teacher_username = ? AND c.archived_at IS NULL';
  const bindings: unknown[] = actor.role === 'admin' ? [] : [actor.username];
  let cursorSql = '';
  if (cursor) {
    cursorSql = ' AND (b.created_at < ? OR (b.created_at = ? AND b.id < ?))';
    bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  bindings.push(limit + 1);
  const result = await db.prepare(`
    SELECT b.* FROM coin_award_batches b
    LEFT JOIN classes c ON c.id = b.class_id
    WHERE ${where}${cursorSql}
    ORDER BY b.created_at DESC, b.id DESC LIMIT ?
  `).bind(...bindings).all<CoinAwardBatchRow>();
  const rows = result.results || [];
  const hasNext = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  return {
    items: pageRows.map((row) => ({ ...mapBatchToReceipt(row, false), parentBatchId: row.parent_batch_id, hanoiDate: row.hanoi_date })),
    nextCursor: hasNext && pageRows.length > 0
      ? encodeHistoryCursor(pageRows[pageRows.length - 1].created_at, pageRows[pageRows.length - 1].id)
      : null,
  };
};

export const listStudentBatches = async (
  db: D1Database,
  studentId: string,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<CoinAwardHistoryPage> => {
  const requestedLimit = Number(options.limit);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.trunc(requestedLimit))) : 25;
  const cursor = decodeHistoryCursor(options.cursor);
  const bindings: unknown[] = [studentId];
  const cursorSql = cursor
    ? ' AND (l.created_at < ? OR (l.created_at = ? AND l.id < ?))'
    : '';
  if (cursor) bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
  bindings.push(limit + 1);
  const result = await db.prepare(`
    SELECT b.*, l.id AS ledger_id, l.coins_delta AS ledger_coins_delta,
           l.created_at AS ledger_created_at
    FROM student_reward_ledger l JOIN coin_award_batches b
      ON json_extract(l.payload_json, '$.batchId') = b.id
    WHERE l.student_id = ? AND l.source_type IN ('MANUAL_AWARD', 'MANUAL_AWARD_REVERSAL')${cursorSql}
    ORDER BY l.created_at DESC, l.id DESC LIMIT ?
  `).bind(...bindings).all<CoinAwardBatchRow & {
    ledger_id: string;
    ledger_coins_delta: number;
    ledger_created_at: string;
  }>();
  const rows = result.results || [];
  const hasNext = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  return {
    items: pageRows.map((row) => ({
      ...mapBatchToReceipt({ ...row, coins_per_student: Number(row.ledger_coins_delta), total_coins: Number(row.ledger_coins_delta) }, false),
      parentBatchId: row.parent_batch_id,
      hanoiDate: row.hanoi_date,
    })),
    nextCursor: hasNext && pageRows.length > 0
      ? encodeHistoryCursor(String(pageRows[pageRows.length - 1].ledger_created_at), pageRows[pageRows.length - 1].ledger_id)
      : null,
  };
};

export const getSystemHanoiDate = (value: Date): string => getSystemDateKey(value);
