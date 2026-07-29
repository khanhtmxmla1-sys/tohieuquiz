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
  severity: string;
  title: string;
  body: string | null;
  action_url: string | null;
  data: string;
  is_read: number;
  created_at: string;
  available_at: string | null;
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
    if (this.sql.includes('GROUP BY severity')) return { results: this.db.metricRows as T[] };
    return { results: this.db.rows as T[] };
  }

  async first<T>() {
    if (this.sql.includes('COUNT(*) AS count')) return { count: this.db.unreadCount } as T;
    if (this.sql.includes('FROM notification_preferences')) return this.db.preferenceRow as T | null;
    return null;
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
    readonly runChanges = 0,
    readonly unreadCount = 0,
    readonly preferenceRow: Record<string, unknown> | null = null,
    readonly metricRows: Record<string, unknown>[] = [],
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
  severity: 'action_required',
  title: 'B?i m?i',
  body: 'Em c? m?t b?i t?p m?i.',
  action_url: null,
  data: '{"assignment_id":"assignment-1"}',
  is_read: 0,
  created_at: `2026-07-24T00:00:0${id}.000Z`,
  available_at: `2026-07-24T00:00:0${id}.000Z`,
  expires_at: null,
  ...overrides,
});

const env = (db: FakeDatabase) => ({ DB: db }) as any;

describe('preference-aware notification inbox API', () => {
  beforeEach(() => {
    currentUser = {
      id: 'student-1',
      username: 'student-1',
      role: 'student',
    };
  });

  it('returns only visible JWT-owned notifications, unread count and opaque cursor', async () => {
    const db = new FakeDatabase([
      row('2'),
      row('1', { data: '{not-json', is_read: 1 }),
    ], 0, 7);

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
        severity: 'action_required',
        data: { assignment_id: 'assignment-1' },
        isRead: false,
      }),
    ]);
    expect(payload.data.unreadCount).toBe(7);
    expect(payload.data.nextCursor).toEqual(expect.any(String));
    expect(payload.data.nextCursor).not.toContain('2026-07-24');
    expect(db.statements[0].bindings.slice(0, 2)).toEqual(['student-1', 'student']);
    expect(db.statements[0].sql).toContain('available_at');
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

  it('rejects malformed cursors and limits above 100', async () => {
    const malformed = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/notifications?cursor=not-a-cursor'),
      env(new FakeDatabase()),
      '/api/notifications',
      'GET',
    );
    const tooLarge = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/notifications?limit=101'),
      env(new FakeDatabase()),
      '/api/notifications',
      'GET',
    );

    expect(malformed.status).toBe(400);
    expect(tooLarge.status).toBe(400);
  });

  it('marks read, click and read-all only through recipient-scoped updates', async () => {
    const oneDb = new FakeDatabase([], 1);
    const oneResponse = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/notifications/notification-1/read', { method: 'PATCH' }),
      env(oneDb),
      '/api/notifications/notification-1/read',
      'PATCH',
    );
    const clickDb = new FakeDatabase([], 1);
    const clickResponse = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/notifications/notification-1/click', { method: 'POST' }),
      env(clickDb),
      '/api/notifications/notification-1/click',
      'POST',
    );
    const allDb = new FakeDatabase([], 3);
    const allResponse = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/notifications/read-all', { method: 'PATCH' }),
      env(allDb),
      '/api/notifications/read-all',
      'PATCH',
    );

    expect(oneResponse.status).toBe(200);
    expect(oneDb.statements[0].sql).toContain('read_at = COALESCE');
    expect(oneDb.statements[0].bindings.slice(1)).toEqual(['notification-1', 'student-1', 'student']);
    expect(clickResponse.status).toBe(200);
    expect(clickDb.statements[0].sql).toContain('clicked_at = COALESCE');
    expect(allResponse.status).toBe(200);
    expect((await allResponse.json() as any).data.updated).toBe(3);
    expect(allDb.statements[0].sql).toContain('available_at');
  });

  it('returns 404 when recipient-scoped read update changes no row', async () => {
    const response = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/notifications/other/read', { method: 'PATCH' }),
      env(new FakeDatabase([], 0)),
      '/api/notifications/other/read',
      'PATCH',
    );
    expect(response.status).toBe(404);
  });

  it('loads and upserts preferences without allowing critical disable', async () => {
    const rowDb = new FakeDatabase([], 0, 0, {
      action_required_enabled: 0,
      informational_enabled: 1,
      quiet_hours_enabled: 1,
      quiet_start: '20:00',
      quiet_end: '07:00',
      timezone_offset_minutes: 420,
      type_preferences_json: '{"gift_delivered":false}',
    });
    const getResponse = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/notifications/preferences'),
      env(rowDb),
      '/api/notifications/preferences',
      'GET',
    );
    expect((await getResponse.json() as any).data).toMatchObject({
      criticalEnabled: true,
      actionRequiredEnabled: false,
      quietHoursEnabled: true,
    });

    const saveDb = new FakeDatabase([], 1);
    const saveResponse = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          criticalEnabled: false,
          actionRequiredEnabled: true,
          informationalEnabled: false,
          quietHoursEnabled: true,
          quietStart: '22:00',
          quietEnd: '06:00',
          timezoneOffsetMinutes: 420,
          typePreferences: {},
        }),
      }),
      env(saveDb),
      '/api/notifications/preferences',
      'PUT',
    );
    expect(saveResponse.status).toBe(200);
    expect((await saveResponse.json() as any).data.criticalEnabled).toBe(true);
    expect(saveDb.statements[0].sql).toContain('ON CONFLICT(user_id, user_role)');
  });

  it('exposes aggregate sent/read/click metrics only to admins', async () => {
    const denied = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/admin/notification-metrics'),
      env(new FakeDatabase()),
      '/api/admin/notification-metrics',
      'GET',
    );
    expect(denied.status).toBe(403);

    currentUser = { id: 'admin-1', username: 'admin', role: 'admin' };
    const adminDb = new FakeDatabase([], 0, 0, null, [{
      severity: 'critical', sent: 4, read_count: 3, click_count: 2,
    }]);
    const allowed = await handleNotificationRoutes(
      new Request('https://api.thtohieu.com/api/admin/notification-metrics?from=2026-07-01&to=2026-08-01'),
      env(adminDb),
      '/api/admin/notification-metrics',
      'GET',
    );
    expect(allowed.status).toBe(200);
    expect((await allowed.json() as any).data.buckets).toEqual([
      { severity: 'critical', sent: 4, read: 3, clicked: 2 },
    ]);
  });
});
