import { beforeEach, describe, expect, it } from 'vitest';
import {
  AiQuotaError,
  expireStaleAiActions,
  failAiAction,
  reserveAiAction,
  succeedAiAction,
  type AiWorkflow,
} from '../workers/src/services/teacherAiQuotaLedger';

type ActionRow = {
  action_id: string;
  username: string;
  workflow: AiWorkflow;
  status: 'RESERVED' | 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  usage_date: string;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

const normalizeSql = (sql: string): string => sql.replace(/\s+/g, ' ').trim().toUpperCase();

class FakeStatement {
  private values: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly db: FakeQuotaDb,
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return this.db.first(this.sql, this.values) as T | null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.all(this.sql, this.values) as T[] };
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    return { success: true, meta: { changes: this.db.run(this.sql, this.values) } };
  }
}

class FakeQuotaDb {
  usedCount = 0;
  actions = new Map<string, ActionRow>();

  prepare(sql: string) {
    return new FakeStatement(sql, this);
  }

  first(sql: string, values: unknown[]): unknown {
    const normalized = normalizeSql(sql);

    if (normalized.startsWith('SELECT') && normalized.includes('FROM AI_GENERATION_ACTIONS')) {
      const actionId = String(values[0]);
      return this.actions.get(actionId) ?? null;
    }

    if (normalized.startsWith('SELECT') && normalized.includes('FROM TEACHER_AI_DAILY_USAGE')) {
      return { used_count: this.usedCount };
    }

    if (normalized.startsWith('UPDATE AI_GENERATION_ACTIONS') && normalized.includes("STATUS = 'SUCCEEDED'")) {
      return this.transitionAction(values, 'SUCCEEDED', null);
    }

    if (normalized.startsWith('UPDATE AI_GENERATION_ACTIONS') && normalized.includes("STATUS = 'FAILED'")) {
      return this.transitionAction(values, 'FAILED', String(values[2] ?? 'UNKNOWN'));
    }

    if (normalized.startsWith('UPDATE AI_GENERATION_ACTIONS') && normalized.includes("STATUS = 'EXPIRED'")) {
      return this.transitionAction(values, 'EXPIRED', 'RESERVATION_EXPIRED');
    }

    return null;
  }

  all(sql: string, values: unknown[]): unknown[] {
    const normalized = normalizeSql(sql);
    if (normalized.includes('FROM AI_GENERATION_ACTIONS') && normalized.includes("STATUS = 'RESERVED'")) {
      const username = String(values[0]);
      const threshold = String(values[1]);
      return [...this.actions.values()].filter(
        (action) => action.username === username
          && action.status === 'RESERVED'
          && action.updated_at < threshold,
      );
    }
    return [];
  }

  run(sql: string, values: unknown[]): number {
    const normalized = normalizeSql(sql);

    if (normalized.startsWith('INSERT INTO TEACHER_AI_DAILY_USAGE')) return 1;

    if (normalized.startsWith('UPDATE TEACHER_AI_DAILY_USAGE') && normalized.includes('USED_COUNT = USED_COUNT + 1')) {
      if (this.usedCount >= 5) return 0;
      this.usedCount += 1;
      return 1;
    }

    if (normalized.startsWith('UPDATE TEACHER_AI_DAILY_USAGE') && normalized.includes('USED_COUNT')) {
      this.usedCount = Math.max(0, this.usedCount - 1);
      return 1;
    }

    if (normalized.startsWith('INSERT INTO AI_GENERATION_ACTIONS')) {
      const [actionId, username, workflow, usageDate, createdAt, updatedAt] = values.map(String);
      if (this.actions.has(actionId)) return 0;
      this.actions.set(actionId, {
        action_id: actionId,
        username,
        workflow: workflow as AiWorkflow,
        status: 'RESERVED',
        usage_date: usageDate,
        failure_code: null,
        created_at: createdAt,
        updated_at: updatedAt,
        completed_at: null,
      });
      return 1;
    }

    if (normalized.startsWith('DELETE FROM AI_GENERATION_ACTIONS')) {
      return this.actions.delete(String(values[0])) ? 1 : 0;
    }

    return 0;
  }

  private transitionAction(
    values: unknown[],
    status: ActionRow['status'],
    failureCode: string | null,
  ): Pick<ActionRow, 'usage_date'> | null {
    const isFailure = status === 'FAILED';
    const actionId = String(values[isFailure ? 3 : 2]);
    const username = String(values[isFailure ? 4 : 3]);
    const timestamp = String(values[isFailure ? 2 : 1]);
    const action = this.actions.get(actionId);
    if (!action || action.username !== username || action.status !== 'RESERVED') return null;

    action.status = status;
    action.failure_code = isFailure ? String(values[0]) : failureCode;
    action.updated_at = timestamp;
    action.completed_at = timestamp;
    return { usage_date: action.usage_date };
  }
}

const now = new Date('2026-07-22T02:00:00.000Z');
const teacherInput = {
  actionId: 'ai-1234567890abcdefghij',
  username: 'teacher-a',
  role: 'teacher' as const,
  workflow: 'QUIZ_CREATE' as const,
  now,
};

let fakeDb: FakeQuotaDb;
let db: D1Database;

beforeEach(() => {
  fakeDb = new FakeQuotaDb();
  db = fakeDb as unknown as D1Database;
});

describe('teacher AI quota ledger', () => {
  it('reserves one slot only once for the same action id', async () => {
    const first = await reserveAiAction(db, teacherInput);
    const second = await reserveAiAction(db, teacherInput);

    expect(first.wasCreated).toBe(true);
    expect(second.wasCreated).toBe(false);
    expect(fakeDb.usedCount).toBe(1);
  });

  it('releases a reserved slot when the action fails', async () => {
    await reserveAiAction(db, teacherInput);
    await failAiAction(db, teacherInput.actionId, teacherInput.username, 'UPSTREAM_503', now);

    expect(fakeDb.usedCount).toBe(0);
    expect(fakeDb.actions.get(teacherInput.actionId)?.status).toBe('FAILED');
  });

  it('keeps the slot consumed after success', async () => {
    await reserveAiAction(db, teacherInput);
    await succeedAiAction(db, teacherInput.actionId, teacherInput.username, now);

    expect(fakeDb.usedCount).toBe(1);
    expect(fakeDb.actions.get(teacherInput.actionId)?.status).toBe('SUCCEEDED');
  });

  it('rejects the sixth teacher action and leaves used count at five', async () => {
    fakeDb.usedCount = 5;

    await expect(reserveAiAction(db, teacherInput)).rejects.toMatchObject({
      code: 'AI_DAILY_LIMIT_REACHED',
    });
    expect(fakeDb.usedCount).toBe(5);
    expect(fakeDb.actions.has(teacherInput.actionId)).toBe(false);
  });

  it('does not persist usage for admins', async () => {
    const result = await reserveAiAction(db, { ...teacherInput, role: 'admin' });

    expect(result.dailyLimit).toBeNull();
    expect(fakeDb.usedCount).toBe(0);
  });

  it('rejects an action id reused by another account or workflow', async () => {
    await reserveAiAction(db, teacherInput);

    await expect(reserveAiAction(db, {
      ...teacherInput,
      username: 'teacher-b',
    })).rejects.toBeInstanceOf(AiQuotaError);

    await expect(reserveAiAction(db, {
      ...teacherInput,
      workflow: 'GENERIC',
    })).rejects.toMatchObject({ code: 'AI_ACTION_CONFLICT' });
  });

  it('keeps repeated failure calls idempotent', async () => {
    await reserveAiAction(db, teacherInput);
    await failAiAction(db, teacherInput.actionId, teacherInput.username, 'UPSTREAM_503', now);
    await failAiAction(db, teacherInput.actionId, teacherInput.username, 'UPSTREAM_503', now);

    expect(fakeDb.usedCount).toBe(0);
  });

  it('expires stale reservations and releases their slots', async () => {
    fakeDb.usedCount = 1;
    fakeDb.actions.set(teacherInput.actionId, {
      action_id: teacherInput.actionId,
      username: teacherInput.username,
      workflow: teacherInput.workflow,
      status: 'RESERVED',
      usage_date: '2026-07-22',
      failure_code: null,
      created_at: '2026-07-22T01:00:00.000Z',
      updated_at: '2026-07-22T01:00:00.000Z',
      completed_at: null,
    });

    const expired = await expireStaleAiActions(db, teacherInput.username, now);

    expect(expired).toBe(1);
    expect(fakeDb.usedCount).toBe(0);
    expect(fakeDb.actions.get(teacherInput.actionId)?.status).toBe('EXPIRED');
  });
});
