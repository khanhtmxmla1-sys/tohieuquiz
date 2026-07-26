export type AiWorkflow = 'QUIZ_CREATE' | 'QUESTION_REGENERATE' | 'GENERIC';
export type AiActionStatus = 'RESERVED' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';

export interface AiActionReservation {
  actionId: string;
  workflow: AiWorkflow;
  status: AiActionStatus;
  usedCount: number;
  dailyLimit: number | null;
  wasCreated: boolean;
}

interface AiActionRow {
  action_id: string;
  username: string;
  workflow: AiWorkflow;
  status: AiActionStatus;
  usage_date: string;
}

interface UsageDateRow {
  usage_date: string;
}

const TEACHER_DAILY_AI_LIMIT = 5;
const RESERVATION_TTL_MS = 15 * 60 * 1000;

export class AiQuotaError extends Error {
  constructor(public readonly code: 'AI_DAILY_LIMIT_REACHED' | 'AI_ACTION_CONFLICT') {
    super(code === 'AI_DAILY_LIMIT_REACHED'
      ? 'Bạn đã dùng hết 5 lượt tạo đề AI hôm nay.'
      : 'Mã thao tác AI đã được sử dụng cho một yêu cầu khác.');
    this.name = 'AiQuotaError';
  }
}

export const getBangkokDateKey = (date = new Date()): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);

const getChanges = (result: D1Result<unknown>): number => {
  const changes = Number(result.meta?.changes ?? 0);
  return Number.isFinite(changes) ? changes : 0;
};

const findAction = async (db: D1Database, actionId: string): Promise<AiActionRow | null> => {
  return db.prepare(`
    SELECT action_id, username, workflow, status, usage_date
    FROM ai_generation_actions
    WHERE action_id = ?
    LIMIT 1
  `).bind(actionId).first<AiActionRow>();
};

const getUsedCount = async (db: D1Database, username: string, usageDate: string): Promise<number> => {
  const row = await db.prepare(`
    SELECT used_count
    FROM teacher_ai_daily_usage
    WHERE username = ?
      AND usage_date = ?
    LIMIT 1
  `).bind(username, usageDate).first<{ used_count?: number }>();

  const count = Number(row?.used_count ?? 0);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

const releaseUsageSlot = async (db: D1Database, username: string, usageDate: string, nowIso: string): Promise<void> => {
  await db.prepare(`
    UPDATE teacher_ai_daily_usage
    SET used_count = MAX(0, used_count - 1),
        updated_at = ?
    WHERE username = ?
      AND usage_date = ?
      AND used_count > 0
  `).bind(nowIso, username, usageDate).run();
};

const validateExistingAction = (
  action: AiActionRow,
  username: string,
  workflow: AiWorkflow,
): void => {
  if (action.username !== username || action.workflow !== workflow) {
    throw new AiQuotaError('AI_ACTION_CONFLICT');
  }
};

const toReservation = async (
  db: D1Database,
  action: AiActionRow,
  role: 'teacher' | 'admin',
  wasCreated: boolean,
): Promise<AiActionReservation> => ({
  actionId: action.action_id,
  workflow: action.workflow,
  status: action.status,
  usedCount: role === 'admin' ? 0 : await getUsedCount(db, action.username, action.usage_date),
  dailyLimit: role === 'admin' ? null : TEACHER_DAILY_AI_LIMIT,
  wasCreated,
});

export async function expireStaleAiActions(
  db: D1Database,
  username: string,
  now = new Date(),
): Promise<number> {
  const nowIso = now.toISOString();
  const threshold = new Date(now.getTime() - RESERVATION_TTL_MS).toISOString();
  const stale = await db.prepare(`
    SELECT action_id, usage_date
    FROM ai_generation_actions
    WHERE username = ?
      AND status = 'RESERVED'
      AND updated_at < ?
  `).bind(username, threshold).all<Pick<AiActionRow, 'action_id' | 'usage_date'>>();

  let expiredCount = 0;
  for (const action of stale.results ?? []) {
    const transitioned = await db.prepare(`
      UPDATE ai_generation_actions
      SET status = 'EXPIRED',
          failure_code = 'RESERVATION_EXPIRED',
          updated_at = ?,
          completed_at = ?
      WHERE action_id = ?
        AND username = ?
        AND status = 'RESERVED'
      RETURNING usage_date
    `).bind(nowIso, nowIso, action.action_id, username).first<UsageDateRow>();

    if (!transitioned) continue;
    await releaseUsageSlot(db, username, transitioned.usage_date, nowIso);
    expiredCount += 1;
  }

  return expiredCount;
}

export async function reserveAiAction(
  db: D1Database,
  input: {
    actionId: string;
    username: string;
    role: 'teacher' | 'admin';
    workflow: AiWorkflow;
    now?: Date;
  },
): Promise<AiActionReservation> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const usageDate = getBangkokDateKey(now);

  await expireStaleAiActions(db, input.username, now);

  const existing = await findAction(db, input.actionId);
  if (existing) {
    validateExistingAction(existing, input.username, input.workflow);
    return toReservation(db, existing, input.role, false);
  }

  if (input.role === 'admin') {
    const inserted = await db.prepare(`
      INSERT INTO ai_generation_actions (
        action_id, username, workflow, status, usage_date, created_at, updated_at
      ) VALUES (?, ?, ?, 'RESERVED', ?, ?, ?)
      ON CONFLICT(action_id) DO NOTHING
    `).bind(
      input.actionId,
      input.username,
      input.workflow,
      usageDate,
      nowIso,
      nowIso,
    ).run();

    if (getChanges(inserted) === 0) {
      const racedAction = await findAction(db, input.actionId);
      if (!racedAction) throw new AiQuotaError('AI_ACTION_CONFLICT');
      validateExistingAction(racedAction, input.username, input.workflow);
      return toReservation(db, racedAction, input.role, false);
    }

    return {
      actionId: input.actionId,
      workflow: input.workflow,
      status: 'RESERVED',
      usedCount: 0,
      dailyLimit: null,
      wasCreated: true,
    };
  }

  await db.prepare(`
    INSERT INTO teacher_ai_daily_usage (
      username, usage_date, used_count, created_at, updated_at
    ) VALUES (?, ?, 0, ?, ?)
    ON CONFLICT(username, usage_date) DO NOTHING
  `).bind(input.username, usageDate, nowIso, nowIso).run();

  const acquired = await db.prepare(`
    UPDATE teacher_ai_daily_usage
    SET used_count = used_count + 1,
        updated_at = ?
    WHERE username = ?
      AND usage_date = ?
      AND used_count < ?
  `).bind(nowIso, input.username, usageDate, TEACHER_DAILY_AI_LIMIT).run();

  if (getChanges(acquired) === 0) {
    throw new AiQuotaError('AI_DAILY_LIMIT_REACHED');
  }

  let inserted: D1Result<unknown>;
  try {
    inserted = await db.prepare(`
      INSERT INTO ai_generation_actions (
        action_id, username, workflow, status, usage_date, created_at, updated_at
      ) VALUES (?, ?, ?, 'RESERVED', ?, ?, ?)
      ON CONFLICT(action_id) DO NOTHING
    `).bind(
      input.actionId,
      input.username,
      input.workflow,
      usageDate,
      nowIso,
      nowIso,
    ).run();
  } catch (error) {
    await releaseUsageSlot(db, input.username, usageDate, nowIso);
    throw error;
  }

  if (getChanges(inserted) === 0) {
    await releaseUsageSlot(db, input.username, usageDate, nowIso);
    const racedAction = await findAction(db, input.actionId);
    if (!racedAction) throw new AiQuotaError('AI_ACTION_CONFLICT');
    validateExistingAction(racedAction, input.username, input.workflow);
    return toReservation(db, racedAction, input.role, false);
  }

  return {
    actionId: input.actionId,
    workflow: input.workflow,
    status: 'RESERVED',
    usedCount: await getUsedCount(db, input.username, usageDate),
    dailyLimit: TEACHER_DAILY_AI_LIMIT,
    wasCreated: true,
  };
}

export async function succeedAiAction(
  db: D1Database,
  actionId: string,
  username: string,
  now = new Date(),
): Promise<void> {
  const nowIso = now.toISOString();
  await db.prepare(`
    UPDATE ai_generation_actions
    SET status = 'SUCCEEDED',
        updated_at = ?,
        completed_at = ?
    WHERE action_id = ?
      AND username = ?
      AND status = 'RESERVED'
    RETURNING usage_date
  `).bind(nowIso, nowIso, actionId, username).first<UsageDateRow>();
}

export async function failAiAction(
  db: D1Database,
  actionId: string,
  username: string,
  failureCode: string,
  now = new Date(),
): Promise<void> {
  const nowIso = now.toISOString();
  const transitioned = await db.prepare(`
    UPDATE ai_generation_actions
    SET status = 'FAILED',
        failure_code = ?,
        updated_at = ?,
        completed_at = ?
    WHERE action_id = ?
      AND username = ?
      AND status = 'RESERVED'
    RETURNING usage_date
  `).bind(failureCode, nowIso, nowIso, actionId, username).first<UsageDateRow>();

  if (!transitioned) return;
  await releaseUsageSlot(db, username, transitioned.usage_date, nowIso);
}
