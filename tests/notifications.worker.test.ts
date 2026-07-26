// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload = {
  id: 'student-1',
  username: 'student-1',
  role: 'student',
};

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
}));

import { handleNotificationRoutes } from '../workers/src/routes/notifications/route';

type NotificationRow = {
  id: string;
  type: string;
  priority: string;
  title: string;
  body: string | null;
  action_url: string | null;
  data: string;
  is_read: number;
  created_at: string;
  expires_at: string | null;
};

class FakeStatement {
  bindings: unknown[] = [];

  constructor(
    readonly sql: string,
    private readonly db: FakeDatabase,
  ) {}

  bind(...bindings: unknown[]) {
    this.bindings = bindings;
    return this;
  }

  async all<T>() {
    return { results: this.db.rows as T[] };
  }

  async first<T>() {
    return (this.db.ownedNotification ? { id: this.db.ownedNotification } : null) as T | null;
  }

  async run() {
    return {
      success: true,
      meta: { changes: this.db.runChanges },
    };
  }
}

class FakeDatabase {
  readonly statements: FakeStatement[] = [];

  constructor(
    readonly rows: NotificationRow[] = [],
    readonly ownedNotification: string | null = null,
    readonly runChanges = 0,
  ) {}

  prepare(sql: string) {
    const statement = new FakeStatement(sql, this);
    this.statements.push(statement);
    return statement;
  }
}

const row = (
  id: string,
  overrides: Partial<NotificationRow> = {},
): NotificationRow => ({
  id,
  type: 'assignment_created',
  priority: 'REMINDER',
  title: 'Bài mới',
  body: 'Em có một bài tập mới.',
  action_url: null,
  data: '{"assignment_id":"assignment-1"}',
  is_read: 0,
  created_at: `2026-07-24T00:00:0${id}.000Z`,
  expires_at: null,
  ...overrides,
});

const env = (db: FakeDatabase) => ({ DB: db }) as any;

describe('generic notification inbox API', () => {
  beforeEach(() => {
    currentUser = {
      id: 'student-1',
      username: 'student-1',
      role: 'student',
    };
  });

  it('returns only the JWT inbox with parsed payloads and an opaque cursor', async () => {
    const db = new FakeDatabase([
      row('2'),
      row('1', { data: '{not-json', is_read: 1 }),
    ]);

    const response = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/notifications?limit=1'),
      env(db),
      '/api/notifications',
      'GET',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data.items).toEqual([
      expect.objectContaining({
        id: '2',
        priority: 'REMINDER',
        data: { assignment_id: 'assignment-1' },
        isRead: false,
      }),
    ]);
    expect(payload.data.nextCursor).toEqual(expect.any(String));
    expect(payload.data.nextCursor).not.toContain('2026-07-24');
    expect(db.statements[0].bindings.slice(0, 2)).toEqual(['student-1', 'student']);
    expect(db.statements[0].sql).toContain('(expires_at IS NULL OR expires_at > ?)');
  });

  it('adds unread and cursor predicates without trusting a client user id', async () => {
    const firstDb = new FakeDatabase([row('2'), row('1')]);
    const firstResponse = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/notifications?filter=unread&limit=1&user_id=other'),
      env(firstDb),
      '/api/notifications',
      'GET',
    );
    const firstPayload = await firstResponse.json() as any;

    const secondDb = new FakeDatabase([]);
    const secondResponse = await handleNotificationRoutes(
      new Request(
        `https://api.thtohieu.com/api/notifications?filter=unread&limit=1&cursor=${encodeURIComponent(firstPayload.data.nextCursor)}`,
      ),
      env(secondDb),
      '/api/notifications',
      'GET',
    );

    expect(secondResponse.status).toBe(200);
    expect(firstDb.statements[0].sql).toContain('is_read = 0');
    expect(secondDb.statements[0].sql).toContain('created_at < ?');
    expect(firstDb.statements[0].bindings).not.toContain('other');
  });

  it('rejects a malformed cursor', async () => {
    const response = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/notifications?cursor=not-a-cursor'),
      env(new FakeDatabase()),
      '/api/notifications',
      'GET',
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: 'error',
      message: expect.stringContaining('cursor'),
    });
  });

  it('does not mark another user notification as read', async () => {
    const db = new FakeDatabase([], null, 0);
    const response = await handleNotificationRoutes(
      new Request(
        'https://api.thtohieu.com/api/notifications/notification-1/read',
        { method: 'PATCH' },
      ),
      env(db),
      '/api/notifications/notification-1/read',
      'PATCH',
    );

    expect(response.status).toBe(404);
    expect(db.statements).toHaveLength(1);
    expect(db.statements[0].bindings).toEqual([
      'notification-1',
      'student-1',
      'student',
    ]);
  });

  it('marks one owned notification and all owned notifications as read', async () => {
    const oneDb = new FakeDatabase([], 'notification-1', 1);
    const oneResponse = await handleNotificationRoutes(
      new Request(
        'https://api.thtohieu.com/api/notifications/notification-1/read',
        { method: 'PATCH' },
      ),
      env(oneDb),
      '/api/notifications/notification-1/read',
      'PATCH',
    );
    const onePayload = await oneResponse.json() as any;

    const allDb = new FakeDatabase([], null, 3);
    const allResponse = await handleNotificationRoutes(
      new Request(
        'https://api.thtohieu.com/api/notifications/read-all',
        { method: 'PATCH' },
      ),
      env(allDb),
      '/api/notifications/read-all',
      'PATCH',
    );
    const allPayload = await allResponse.json() as any;

    expect(oneResponse.status).toBe(200);
    expect(onePayload.data).toEqual({ id: 'notification-1', isRead: true });
    expect(oneDb.statements[1].sql).toContain('user_id = ? AND user_role = ?');
    expect(allResponse.status).toBe(200);
    expect(allPayload.data).toEqual({ updated: 3 });
    expect(allDb.statements[0].bindings).toEqual(['student-1', 'student']);
  });
});
