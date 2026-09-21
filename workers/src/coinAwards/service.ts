import {
  COIN_AWARD_TECHNICAL_MAX,
  type CoinAwardCreateInput,
  type CoinAwardHistoryPage,
  type CoinAwardReceipt,
  type CoinAwardSettings,
} from '../../../shared/coin-awards.contract';
import { prepareMandatoryNotificationBatch } from '../services/notificationWriter';
import { prepareStudentRewardBatch, type StudentRewardMutation } from '../gamification/studentRewardLedger';
import { generateId } from '../utils/response';
import {
  buildCoinAwardBatchInsert,
  buildCoinAwardSettingsUpdate,
  coinAwardReceiptFromRow,
  findCoinAwardBatchByIdempotency,
  getCoinAwardBatch,
  getCoinAwardBatchRecipients,
  getCoinAwardSettings as readSettings,
  getTeacherDailyAwardTotal,
  getSystemHanoiDate,
  listStaffBatches,
  listStudentBatches,
  resolveCoinAwardScope,
  type CoinAwardActor,
  type CoinAwardBatchRow,
  type CoinAwardStudent,
} from './repository';
import {
  CoinAwardDomainError,
  domainError,
  normalizeAdjustmentInput,
  normalizeCoinAwardInput,
  type NormalizedCoinAwardInput,
} from './validation';

export type { CoinAwardActor } from './repository';

export interface CoinAwardPreview {
  classId: string | null;
  className: string | null;
  studentIds: string[];
  recipientCount: number;
  coinsPerStudent: number;
  totalCoins: number;
  reason: string;
  remainingTeacherDailyCoins: number | null;
}

export interface CoinAwardSettingsUpdateInput {
  maxCoinsPerStudent: number;
  maxTeacherDailyCoins: number;
  reversalWindowMinutes: number;
  expectedUpdatedAt: string;
  reason: string;
}

export interface CoinAwardAdjustmentInput {
  parentBatchId: string;
  studentIds: string[];
  reason: string;
  idempotencyKey: string;
}

export interface CoinAwardPolicySnapshot {
  maxCoinsPerStudent: number;
  maxTeacherDailyCoins: number;
  reversalWindowMinutes: number;
  teacherDailyCoinsBefore: number;
  teacherDailyCoinsAfter: number;
}

const asIso = (value?: Date): string => (value || new Date()).toISOString();

const sha256 = async (value: string): Promise<string> => {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const requestHash = async (
  input: NormalizedCoinAwardInput,
  recipients: CoinAwardStudent[],
  parentBatchId: string | null = null,
): Promise<string> => sha256(JSON.stringify({
  parentBatchId,
  classId: input.classId,
  selectionMode: input.selectionMode,
  studentIds: recipients.map((student) => student.id).sort(),
  coinsPerStudent: input.coinsPerStudent,
  reason: input.reason,
}));

const normalizeReason = (value: unknown, fallback = 'Hoàn tác thưởng xu'): string => {
  const reason = String(value ?? fallback).trim();
  if (reason.length < 3 || reason.length > 200) throw domainError('INVALID_REASON', 'Reason must contain 3–200 characters');
  return reason;
};

const mapDbError = (error: unknown, duplicateCode?: 'ALREADY_REVERSED' | 'IDEMPOTENCY_CONFLICT'): never => {
  const message = error instanceof Error ? error.message : String(error);
  if (/COIN_AWARD_PER_STUDENT_LIMIT|COIN_AWARD_DAILY_LIMIT/i.test(message)) {
    throw domainError('LIMIT_EXCEEDED', 'Teacher coin award limit exceeded');
  }
  if (/INSUFFICIENT_COIN_BALANCE/i.test(message)) {
    throw domainError('INSUFFICIENT_BALANCE', 'Student balance is not sufficient for this adjustment');
  }
  if (/UNIQUE constraint failed: coin_award_batches/i.test(message)) {
    throw domainError(duplicateCode || 'IDEMPOTENCY_CONFLICT', duplicateCode === 'ALREADY_REVERSED'
      ? 'The award batch was already reversed'
      : 'Idempotency key is already in use');
  }
  throw error;
};

const checkTeacherLimits = async (
  db: D1Database,
  actor: CoinAwardActor,
  amount: number,
  recipientCount: number,
  hanoiDate: string,
): Promise<CoinAwardPolicySnapshot> => {
  const settings = await readSettings(db);
  const currentTotal = actor.role === 'teacher'
    ? await getTeacherDailyAwardTotal(db, actor.username, hanoiDate)
    : 0;
  const projectedTotal = currentTotal + (actor.role === 'teacher' ? amount * recipientCount : 0);
  if (actor.role !== 'teacher') {
    return {
      maxCoinsPerStudent: settings.maxCoinsPerStudent,
      maxTeacherDailyCoins: settings.maxTeacherDailyCoins,
      reversalWindowMinutes: settings.reversalWindowMinutes,
      teacherDailyCoinsBefore: 0,
      teacherDailyCoinsAfter: 0,
    };
  }
  if (amount > settings.maxCoinsPerStudent || currentTotal + amount * recipientCount > settings.maxTeacherDailyCoins) {
    throw domainError('LIMIT_EXCEEDED', 'Teacher coin award limit exceeded');
  }
  return {
    maxCoinsPerStudent: settings.maxCoinsPerStudent,
    maxTeacherDailyCoins: settings.maxTeacherDailyCoins,
    reversalWindowMinutes: settings.reversalWindowMinutes,
    teacherDailyCoinsBefore: currentTotal,
    teacherDailyCoinsAfter: projectedTotal,
  };
};

const readPolicySnapshot = async (
  db: D1Database,
  actor: CoinAwardActor,
  hanoiDate: string,
): Promise<CoinAwardPolicySnapshot> => {
  const settings = await readSettings(db);
  const currentTotal = actor.role === 'teacher'
    ? await getTeacherDailyAwardTotal(db, actor.username, hanoiDate)
    : 0;
  return {
    maxCoinsPerStudent: settings.maxCoinsPerStudent,
    maxTeacherDailyCoins: settings.maxTeacherDailyCoins,
    reversalWindowMinutes: settings.reversalWindowMinutes,
    teacherDailyCoinsBefore: currentTotal,
    teacherDailyCoinsAfter: currentTotal,
  };
};

const makeAwardPayload = (
  batchId: string,
  actor: CoinAwardActor,
  input: NormalizedCoinAwardInput,
  student: CoinAwardStudent,
  kind: 'AWARD' | 'REVERSAL' | 'ADJUSTMENT',
  parentBatchId: string | null,
  idempotencyKey: string,
  createdAt: string,
  originalLedgerId: string | null,
  policySnapshot: CoinAwardPolicySnapshot,
) => ({
  batchId,
  parentBatchId,
  originalLedgerId,
  actorId: actor.username,
  actorDisplayName: actor.displayName,
  actorRole: actor.role,
  classId: student.classId,
  className: student.className,
  reason: input.reason,
  selectionMode: input.selectionMode,
  idempotencyKey,
  kind,
  policySnapshot,
  createdAt,
});

const makeNotifications = (
  batchId: string,
  actor: CoinAwardActor,
  recipients: CoinAwardStudent[],
  amount: number,
  reason: string,
  createdAt: string,
) => recipients.map((student) => ({
  id: generateId('coin-notification'),
  userId: student.username,
  userRole: 'student' as const,
  type: 'coin_awarded' as const,
  title: amount >= 0 ? `Bạn được ${actor.displayName} thưởng ${amount} xu` : `Xu của bạn đã được điều chỉnh ${amount} xu`,
  body: `Lý do: ${reason}`,
  priority: 'INFO' as const,
  severity: 'informational' as const,
  data: { batchId, coinsDelta: amount, actorDisplayName: actor.displayName, reason },
  sourceType: 'coin_award_batch',
  sourceId: batchId,
  actionUrl: '/student/achievements?view=coin-history',
  createdAt,
}));

const loadReceiptOrThrow = async (db: D1Database, batchId: string, alreadyProcessed: boolean): Promise<CoinAwardReceipt> => {
  const row = await getCoinAwardBatch(db, batchId);
  if (!row) throw new Error('Coin award receipt missing after commit');
  return coinAwardReceiptFromRow(row, alreadyProcessed);
};

const checkReplay = async (
  db: D1Database,
  actor: CoinAwardActor,
  idempotencyKey: string,
  hash: string,
): Promise<CoinAwardReceipt | null> => {
  const existing = await findCoinAwardBatchByIdempotency(db, actor.username, idempotencyKey);
  if (!existing) return null;
  if (existing.request_hash !== hash) throw domainError('IDEMPOTENCY_CONFLICT', 'Idempotency key payload differs');
  return coinAwardReceiptFromRow(existing, true);
};

export const previewCoinAward = async (
  db: D1Database,
  actor: CoinAwardActor,
  input: CoinAwardCreateInput,
  now = new Date(),
): Promise<CoinAwardPreview> => {
  const normalized = normalizeCoinAwardInput(input);
  const scope = await resolveCoinAwardScope(db, actor, normalized.classId, normalized.selectionMode, normalized.studentIds);
  const policy = await checkTeacherLimits(
    db, actor, normalized.coinsPerStudent, scope.recipients.length, getSystemHanoiDate(now),
  );
  return {
    classId: scope.classroom?.id || (scope.recipients[0]?.classId || null),
    className: scope.classroom?.name || (scope.recipients[0]?.className || null),
    studentIds: scope.recipients.map((student) => student.id),
    recipientCount: scope.recipients.length,
    coinsPerStudent: normalized.coinsPerStudent,
    totalCoins: normalized.coinsPerStudent * scope.recipients.length,
    reason: normalized.reason,
    remainingTeacherDailyCoins: actor.role === 'teacher'
      ? policy.maxTeacherDailyCoins - policy.teacherDailyCoinsAfter
      : null,
  };
};

export const createCoinAward = async (
  db: D1Database,
  actor: CoinAwardActor,
  input: CoinAwardCreateInput,
  now = new Date(),
): Promise<CoinAwardReceipt> => {
  const normalized = normalizeCoinAwardInput(input);
  const scope = await resolveCoinAwardScope(db, actor, normalized.classId, normalized.selectionMode, normalized.studentIds);
  const hash = await requestHash(normalized, scope.recipients);
  const replay = await checkReplay(db, actor, normalized.idempotencyKey, hash);
  if (replay) return replay;
  const createdAt = asIso(now);
  const hanoiDate = getSystemHanoiDate(now);
  const policySnapshot = await checkTeacherLimits(db, actor, normalized.coinsPerStudent, scope.recipients.length, hanoiDate);
  const batchId = generateId('coin-award');
  const reversalWindow = actor.role === 'teacher' ? policySnapshot.reversalWindowMinutes : 0;
  const reversalExpiresAt = actor.role === 'teacher'
    ? new Date(now.getTime() + reversalWindow * 60_000).toISOString()
    : null;
  const classIds = new Set(scope.recipients.map((student) => student.classId));
  const classId = scope.classroom?.id || (classIds.size === 1 ? scope.recipients[0]?.classId || null : null);
  const className = scope.classroom?.name || (classIds.size === 1 ? scope.recipients[0]?.className || null : null);
  const mutations: StudentRewardMutation[] = scope.recipients.map((student) => ({
    studentId: student.id,
    username: student.username,
    sourceType: 'MANUAL_AWARD',
    sourceKey: batchId,
    rewardType: 'COINS',
    coinsDelta: normalized.coinsPerStudent,
    expDelta: 0,
    payload: makeAwardPayload(
      batchId, actor, normalized, student, 'AWARD', null, normalized.idempotencyKey, createdAt,
      null, policySnapshot,
    ),
  }));
  const preparedRewards = prepareStudentRewardBatch(db, mutations);
  const notificationStatement = prepareMandatoryNotificationBatch(
    db,
    makeNotifications(batchId, actor, scope.recipients, normalized.coinsPerStudent, normalized.reason, createdAt),
  );
  const batchRow = {
    id: batchId,
    kind: 'AWARD' as const,
    parent_batch_id: null,
    actor_username: actor.username,
    actor_display_name: actor.displayName,
    actor_role: actor.role,
    selection_mode: normalized.selectionMode,
    class_id: classId,
    class_name: className,
    coins_per_student: normalized.coinsPerStudent,
    recipient_count: scope.recipients.length,
    total_coins: normalized.coinsPerStudent * scope.recipients.length,
    reason: normalized.reason,
    idempotency_key: normalized.idempotencyKey,
    request_hash: hash,
    hanoi_date: hanoiDate,
    reversal_expires_at: reversalExpiresAt,
    created_at: createdAt,
  } satisfies CoinAwardBatchRow;
  try {
    await db.batch([buildCoinAwardBatchInsert(db, batchRow), ...preparedRewards.statements, notificationStatement]);
  } catch (error) {
    try {
      const raced = await checkReplay(db, actor, normalized.idempotencyKey, hash);
      if (raced) return raced;
    } catch (replayError) {
      if (replayError instanceof CoinAwardDomainError) throw replayError;
    }
    mapDbError(error);
  }
  return loadReceiptOrThrow(db, batchId, false);
};

const resolveOriginal = async (db: D1Database, batchId: string): Promise<{ batch: CoinAwardBatchRow; recipients: CoinAwardStudent[] }> => {
  const batch = await getCoinAwardBatch(db, batchId);
  if (!batch || batch.kind !== 'AWARD') throw domainError('INVALID_SELECTION', 'Original award batch was not found');
  const ledgerRecipients = await getCoinAwardBatchRecipients(db, batchId);
  if (ledgerRecipients.length !== batch.recipient_count) throw new Error('Award batch recipient ledger is incomplete');
  const students = await Promise.all(ledgerRecipients.map(async (recipient) => db.prepare(`
    SELECT s.id, s.username, s.full_name AS fullName, s.class_id AS classId,
           c.name AS className, c.teacher_username AS teacherUsername,
           s.coins, s.archived_at AS archivedAt
    FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ? LIMIT 1
  `).bind(recipient.student_id).first<CoinAwardStudent>()));
  if (students.some((student) => !student)) throw new Error('Award batch recipient is missing');
  return {
    batch,
    recipients: students.reduce<CoinAwardStudent[]>((result, student, index) => {
      if (student) result.push({ ...student, originalLedgerId: ledgerRecipients[index].id });
      return result;
    }, []),
  };
};

const buildCompensatingBatch = async (
  db: D1Database,
  actor: CoinAwardActor,
  original: CoinAwardBatchRow,
  recipients: CoinAwardStudent[],
  kind: 'REVERSAL' | 'ADJUSTMENT',
  reason: string,
  now: Date,
  idempotencyKey: string,
): Promise<CoinAwardReceipt> => {
  const createdAt = asIso(now);
  const amount = -Math.abs(Number(original.coins_per_student));
  const hanoiDate = getSystemHanoiDate(now);
  const policySnapshot = await readPolicySnapshot(db, actor, hanoiDate);
  const batchId = generateId(kind === 'REVERSAL' ? 'coin-reversal' : 'coin-adjustment');
  const input: NormalizedCoinAwardInput = {
    classId: original.class_id || recipients[0].classId,
    studentIds: recipients.map((student) => student.id),
    selectionMode: original.selection_mode,
    coinsPerStudent: Math.abs(amount),
    reason,
    idempotencyKey,
  };
  const requestHashValue = await requestHash(input, recipients, original.id);
  const mutations: StudentRewardMutation[] = recipients.map((student) => ({
    studentId: student.id,
    username: student.username,
    sourceType: 'MANUAL_AWARD_REVERSAL',
    sourceKey: batchId,
    rewardType: kind === 'REVERSAL' ? 'COINS_REVERSAL' : 'COINS_ADJUSTMENT',
    coinsDelta: amount,
    expDelta: 0,
    payload: makeAwardPayload(
      batchId, actor, input, student, kind, original.id, idempotencyKey, createdAt,
      student.originalLedgerId || null, policySnapshot,
    ),
  }));
  const preparedRewards = prepareStudentRewardBatch(db, mutations);
  const notificationStatement = prepareMandatoryNotificationBatch(
    db,
    makeNotifications(batchId, actor, recipients, amount, reason, createdAt),
  );
  const row = {
    id: batchId,
    kind,
    parent_batch_id: original.id,
    actor_username: actor.username,
    actor_display_name: actor.displayName,
    actor_role: actor.role,
    selection_mode: original.selection_mode,
    class_id: original.class_id,
    class_name: original.class_name,
    coins_per_student: amount,
    recipient_count: recipients.length,
    total_coins: amount * recipients.length,
    reason,
    idempotency_key: idempotencyKey,
    request_hash: requestHashValue,
    hanoi_date: hanoiDate,
    reversal_expires_at: null,
    created_at: createdAt,
  } satisfies CoinAwardBatchRow;
  try {
    await db.batch([buildCoinAwardBatchInsert(db, row), ...preparedRewards.statements, notificationStatement]);
  } catch (error) {
    if (kind === 'ADJUSTMENT' && /UNIQUE constraint failed: coin_award_batches/i.test(error instanceof Error ? error.message : String(error))) {
      const existing = await findCoinAwardBatchByIdempotency(db, actor.username, idempotencyKey);
      if (existing) {
        if (existing.parent_batch_id === original.id && existing.request_hash === requestHashValue) {
          return coinAwardReceiptFromRow(existing, true);
        }
        throw domainError('IDEMPOTENCY_CONFLICT', 'Idempotency key payload differs');
      }
    }
    mapDbError(error, kind === 'REVERSAL' ? 'ALREADY_REVERSED' : undefined);
  }
  return loadReceiptOrThrow(db, batchId, false);
};

export const reverseCoinAwardBatch = async (
  db: D1Database,
  actor: CoinAwardActor,
  batchId: string,
  reason?: string,
  now = new Date(),
): Promise<CoinAwardReceipt> => {
  if (actor.role !== 'teacher') throw domainError('UNAUTHORIZED_RECIPIENT', 'Teacher reversal is required');
  const { batch, recipients } = await resolveOriginal(db, batchId);
  if (batch.actor_username !== actor.username) throw domainError('UNAUTHORIZED_RECIPIENT', 'Only the original teacher may reverse this batch');
  if (batch.reversal_expires_at && now.getTime() > new Date(batch.reversal_expires_at).getTime()) {
    throw domainError('REVERSAL_EXPIRED', 'The reversal window has expired');
  }
  const child = await db.prepare(`SELECT id FROM coin_award_batches WHERE parent_batch_id = ? LIMIT 1`)
    .bind(batchId).first<{ id: string }>();
  if (child) throw domainError('ALREADY_REVERSED', 'The award batch was already reversed');
  if (batch.class_id) {
    const scope = await resolveCoinAwardScope(db, actor, batch.class_id, 'SELECTED', recipients.map((student) => student.id));
    if (scope.recipients.length !== recipients.length) throw domainError('UNAUTHORIZED_RECIPIENT');
  }
  const underfunded = recipients.filter((student) => Number(student.coins) < Math.abs(Number(batch.coins_per_student)));
  if (underfunded.length > 0) throw domainError('INSUFFICIENT_BALANCE', 'Student balance is not sufficient for reversal', underfunded.map((student) => student.id));
  return buildCompensatingBatch(db, actor, batch, recipients, 'REVERSAL', normalizeReason(reason), now, `${batch.id}:reversal`);
};

export const adjustCoinAwardBatch = async (
  db: D1Database,
  actor: CoinAwardActor,
  input: CoinAwardAdjustmentInput,
  now = new Date(),
): Promise<CoinAwardReceipt> => {
  if (actor.role !== 'admin') throw domainError('UNAUTHORIZED_RECIPIENT', 'Administrator access is required');
  const normalized = normalizeAdjustmentInput(input);
  const original = await resolveOriginal(db, normalized.parentBatchId);
  const originalIds = new Set(original.recipients.map((student) => student.id));
  const invalid = normalized.studentIds.filter((studentId) => !originalIds.has(studentId));
  if (invalid.length > 0) throw domainError('UNAUTHORIZED_RECIPIENT', 'Adjustment recipient was not in the original award', invalid);
  const recipients = original.recipients.filter((student) => normalized.studentIds.includes(student.id));
  const adjustmentHashInput: NormalizedCoinAwardInput = {
    classId: original.batch.class_id || recipients[0].classId,
    studentIds: recipients.map((student) => student.id),
    selectionMode: original.batch.selection_mode,
    coinsPerStudent: Math.abs(Number(original.batch.coins_per_student)),
    reason: normalized.reason,
    idempotencyKey: normalized.idempotencyKey,
  };
  const adjustmentRequestHash = await requestHash(adjustmentHashInput, recipients, original.batch.id);
  const replay = await findCoinAwardBatchByIdempotency(db, actor.username, normalized.idempotencyKey);
  if (replay) {
    if (replay.parent_batch_id !== original.batch.id || replay.request_hash !== adjustmentRequestHash) {
      throw domainError('IDEMPOTENCY_CONFLICT');
    }
    return coinAwardReceiptFromRow(replay, true);
  }
  const underfunded = recipients.filter((student) => Number(student.coins) < Math.abs(Number(original.batch.coins_per_student)));
  if (underfunded.length > 0) throw domainError('INSUFFICIENT_BALANCE', 'Student balance is not sufficient for adjustment', underfunded.map((student) => student.id));
  return buildCompensatingBatch(db, actor, original.batch, recipients, 'ADJUSTMENT', normalized.reason, now, normalized.idempotencyKey);
};

export const listStaffCoinAwardHistory = (
  db: D1Database,
  actor: CoinAwardActor,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<CoinAwardHistoryPage> => listStaffBatches(db, actor, options);

export const listStudentCoinAwardHistory = (
  db: D1Database,
  studentId: string,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<CoinAwardHistoryPage> => listStudentBatches(db, studentId, options);

export const getCoinAwardSettings = (db: D1Database): Promise<CoinAwardSettings> => readSettings(db);

export const updateCoinAwardSettings = async (
  db: D1Database,
  actor: CoinAwardActor,
  input: CoinAwardSettingsUpdateInput,
  now = new Date(),
): Promise<CoinAwardSettings> => {
  if (actor.role !== 'admin') throw domainError('UNAUTHORIZED_RECIPIENT', 'Administrator access is required');
  const reason = normalizeReason(input.reason, 'Cập nhật chính sách thưởng xu');
  if (typeof input.expectedUpdatedAt !== 'string' || !input.expectedUpdatedAt.trim()) {
    throw domainError('SETTINGS_CONFLICT', 'An expected settings timestamp is required');
  }
  if (!Number.isSafeInteger(input.maxCoinsPerStudent) || input.maxCoinsPerStudent < 1 || input.maxCoinsPerStudent > COIN_AWARD_TECHNICAL_MAX) {
    throw domainError('INVALID_AMOUNT', 'Per-student limit is invalid');
  }
  if (!Number.isSafeInteger(input.maxTeacherDailyCoins) || input.maxTeacherDailyCoins < 1 || input.maxTeacherDailyCoins > 100_000_000) {
    throw domainError('INVALID_AMOUNT', 'Daily limit is invalid');
  }
  if (!Number.isSafeInteger(input.reversalWindowMinutes) || input.reversalWindowMinutes < 1 || input.reversalWindowMinutes > 1440) {
    throw domainError('INVALID_AMOUNT', 'Reversal window is invalid');
  }
  const before = await readSettings(db);
  const requestedUpdatedAt = asIso(now);
  const beforeMs = Date.parse(before.updatedAt);
  const requestedMs = Date.parse(requestedUpdatedAt);
  const updatedAt = Number.isFinite(beforeMs) && Number.isFinite(requestedMs) && requestedMs <= beforeMs
    ? new Date(beforeMs + 1).toISOString()
    : requestedUpdatedAt;
  const auditId = generateId('coin-settings-audit');
  const after = {
    scopeKey: 'school' as const,
    maxCoinsPerStudent: input.maxCoinsPerStudent,
    maxTeacherDailyCoins: input.maxTeacherDailyCoins,
    reversalWindowMinutes: input.reversalWindowMinutes,
    updatedBy: actor.username,
    updatedAt,
  };
  try {
    await db.batch([
      buildCoinAwardSettingsUpdate(db, { ...input, updatedBy: actor.username, updatedAt }),
      db.prepare(`
        INSERT INTO coin_award_setting_audit
          (id, scope_key, before_json, after_json, actor_username, reason, created_at)
        SELECT ?, 'school', ?, ?, ?, ?, ?
        WHERE changes() > 0 AND EXISTS (
          SELECT 1 FROM coin_award_settings WHERE scope_key = 'school' AND updated_at = ?
        )
      `).bind(
        auditId, JSON.stringify(before), JSON.stringify(after),
        actor.username, reason, updatedAt, updatedAt,
      ),
    ]);
  } catch (error) {
    mapDbError(error);
  }
  const audit = await db.prepare(`SELECT id FROM coin_award_setting_audit WHERE id = ? LIMIT 1`)
    .bind(auditId).first<{ id: string }>();
  if (!audit) throw domainError('SETTINGS_CONFLICT', 'Settings changed concurrently');
  const current = await readSettings(db);
  if (current.updatedAt !== updatedAt) throw domainError('SETTINGS_CONFLICT', 'Settings changed concurrently');
  return current;
};

export { CoinAwardDomainError };
