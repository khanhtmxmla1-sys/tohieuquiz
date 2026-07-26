import { describe, expect, it } from 'vitest';

import {
  createNotification,
  createNotifications,
} from '../workers/src/services/notificationWriter';

class WriterStatement {
  bindings: unknown[] = [];

  constructor(
    readonly sql: string,
    private readonly db: WriterDatabase,
  ) {}

  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }

  run() {
    return this.db.execute(this);
  }
}

class WriterDatabase {
  private readonly dedupeKeys = new Set<string>();
  readonly statements: WriterStatement[] = [];
  batchCalls = 0;

  prepare(sql: string) {
    return new WriterStatement(sql, this);
  }

  async batch(statements: WriterStatement[]) {
    this.batchCalls += 1;
    return Promise.all(statements.map((statement) => this.execute(statement)));
  }

  async execute(statement: WriterStatement) {
    this.statements.push(statement);
    const [, userId, role, type, , , , , sourceType, sourceId] = statement.bindings;
    const key = [userId, role, sourceType, sourceId, type].join(':');
    const duplicate = Boolean(sourceType && sourceId && this.dedupeKeys.has(key));
    if (!duplicate && sourceType && sourceId) this.dedupeKeys.add(key);
    return { success: true, meta: { changes: duplicate ? 0 : 1 } };
  }
}

const baseInput = {
  userId: 'student-1',
  userRole: 'student' as const,
  type: 'assignment_created' as const,
  title: 'Có bài được giao mới',
  body: 'Toán lớp 4, hạn nộp ngày mai.',
  priority: 'IMPORTANT' as const,
  actionUrl: '/student?assignment=assignment-1',
  data: { assignment_id: 'assignment-1' },
  sourceType: 'assignment',
  sourceId: 'assignment-1',
};

describe('unified notification writer', () => {
  it('validates type, priority, action URL and JSON payload', async () => {
    const db = new WriterDatabase();

    await expect(createNotification(db as any, {
      ...baseInput,
      type: 'unknown' as any,
    })).rejects.toThrow(/type/i);
    await expect(createNotification(db as any, {
      ...baseInput,
      priority: 'NOISY' as any,
    })).rejects.toThrow(/priority/i);
    await expect(createNotification(db as any, {
      ...baseInput,
      actionUrl: 'javascript:alert(1)',
    })).rejects.toThrow(/action/i);

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(createNotification(db as any, {
      ...baseInput,
      data: circular,
    })).rejects.toThrow(/payload/i);
  });

  it('returns duplicate for the same user, role, source and type', async () => {
    const db = new WriterDatabase();

    await expect(createNotification(db as any, baseInput)).resolves.toBe('created');
    await expect(createNotification(db as any, baseInput)).resolves.toBe('duplicate');
  });

  it('uses one D1 batch and reports created versus duplicate counts', async () => {
    const db = new WriterDatabase();
    await createNotification(db as any, baseInput);

    await expect(createNotifications(db as any, [
      baseInput,
      {
        ...baseInput,
        userId: 'student-2',
        data: { assignment_id: 'assignment-1' },
      },
    ])).resolves.toEqual({ created: 1, duplicate: 1 });
    expect(db.batchCalls).toBe(1);
  });

  it('serializes a normalized payload and supports deterministic ids', async () => {
    const db = new WriterDatabase();
    await createNotification(db as any, {
      ...baseInput,
      id: 'notification-1',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    expect(db.statements[0].sql).toContain('INSERT OR IGNORE INTO notifications');
    expect(db.statements[0].bindings).toEqual(expect.arrayContaining([
      'notification-1',
      'student-1',
      'assignment_created',
      JSON.stringify({ assignment_id: 'assignment-1' }),
      '2099-01-01T00:00:00.000Z',
    ]));
  });
});
