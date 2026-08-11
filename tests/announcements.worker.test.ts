// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload = {
  id: 'admin-1',
  username: 'admin-1',
  role: 'admin',
};

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
}));

import { handleAnnouncementRoutes } from '../workers/src/routes/announcements';

type AnnouncementFixture = Record<string, unknown> & { id: string };

const announcement = (
  id: string,
  overrides: Partial<AnnouncementFixture> = {},
): AnnouncementFixture => ({
  id,
  content: `Tin ${id}`,
  is_active: 'true',
  updated_at: '2026-07-24T01:00:00.000Z',
  banner_title: `Tiêu đề ${id}`,
  banner_subtitle: '',
  banner_link: '',
  banner_image: '',
  is_banner_active: 'false',
  days_to_live: 7,
  status: 'PUBLISHED',
  audience: 'ALL',
  starts_at: '2026-07-24T00:00:00.000Z',
  ends_at: null,
  created_by: 'admin-1',
  updated_by: 'admin-1',
  created_at: '2026-07-24T00:00:00.000Z',
  priority: 'INFO',
  channels_json: '["TICKER"]',
  dismissible: 1,
  cta_label: null,
  surface_overrides_json: '{}',
  ...overrides,
});

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

  async first<T>() {
    return (this.db.rows[0] ?? null) as T | null;
  }

  async all<T>() {
    return { results: this.db.rows as T[] };
  }

  async run() {
    return { success: true, meta: { changes: 1 } };
  }
}

class FakeDatabase {
  readonly statements: FakeStatement[] = [];
  readonly batches: FakeStatement[][] = [];

  constructor(readonly rows: AnnouncementFixture[] = []) {}

  prepare(sql: string) {
    const statement = new FakeStatement(sql, this);
    this.statements.push(statement);
    return statement;
  }

  async batch(statements: FakeStatement[]) {
    this.batches.push(statements);
    return statements.map(() => ({ success: true }));
  }
}

const env = (db: FakeDatabase) => ({
  DB: db,
  JWT_SECRET: 'test-secret',
}) as any;

const request = (
  path: string,
  init: RequestInit = {},
  authenticated = false,
) => new Request(`https://api.thtohieu.com${path}`, {
  ...init,
  headers: {
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(authenticated ? { Cookie: 'auth_token=test-token' } : {}),
    ...(init.headers || {}),
  },
});

describe('system announcement delivery', () => {
  beforeEach(() => {
    currentUser = { id: 'admin-1', username: 'admin-1', role: 'admin' };
  });

  it('returns a collection and a legacy first item for public login', async () => {
    const db = new FakeDatabase([
      announcement('important', { priority: 'IMPORTANT', channels_json: '["BANNER"]' }),
      announcement('general'),
    ]);

    const response = await handleAnnouncementRoutes(
      request('/api/announcements'),
      env(db),
      '/api/announcements',
      'GET',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data.items).toHaveLength(2);
    expect(payload.announcement.id).toBe('important');
    expect(payload.data.items[0]).toMatchObject({
      priority: 'IMPORTANT',
      channels: ['BANNER'],
      dismissible: true,
    });
    expect(db.statements[0].sql).toContain("audience = 'ALL'");
    expect(db.statements[0].sql).toContain('LIMIT 20');
  });

  it.each([
    ['teacher', 'TEACHERS'],
    ['admin', 'TEACHERS'],
    ['student', 'STUDENTS'],
  ] as const)('scopes %s delivery to ALL plus %s', async (role, audience) => {
    currentUser = { id: `${role}-1`, username: `${role}-1`, role };
    const db = new FakeDatabase([announcement(role)]);

    await handleAnnouncementRoutes(
      request('/api/announcements/current', {}, true),
      env(db),
      '/api/announcements/current',
      'GET',
    );

    expect(db.statements[0].sql).toContain("audience IN ('ALL', ?)");
    expect(db.statements[0].bindings.at(-1)).toBe(audience);
  });

  it('orders current announcements by priority and recency', async () => {
    const db = new FakeDatabase([announcement('ordered')]);

    await handleAnnouncementRoutes(
      request('/api/announcements'),
      env(db),
      '/api/announcements',
      'GET',
    );

    expect(db.statements[0].sql).toContain("WHEN 'URGENT' THEN 4");
    expect(db.statements[0].sql).toContain('starts_at DESC');
    expect(db.statements[0].sql).toContain('updated_at DESC');
  });
});

describe('system announcement publishing validation', () => {
  beforeEach(() => {
    currentUser = { id: 'admin-1', username: 'admin-1', role: 'admin' };
  });

  it.each([
    [
      'empty meaningful content',
      { priority: 'INFO', channels: ['TICKER'], content: '   ', bannerTitle: '', bannerSubtitle: '' },
      'nội dung',
    ],
    [
      'an empty channel selection',
      { priority: 'INFO', channels: [] },
      'ít nhất một kênh',
    ],
    [
      'an urgent ticker without a critical strip',
      { priority: 'URGENT', channels: ['TICKER'] },
      'Cảnh báo khẩn',
    ],
    [
      'a CTA label without a safe link',
      { priority: 'IMPORTANT', channels: ['BANNER'], ctaLabel: 'Xem ngay' },
      'liên kết',
    ],
  ])('rejects %s', async (_label, overrides, expectedMessage) => {
    const db = new FakeDatabase();
    const body = {
      bannerTitle: 'Thông báo thử nghiệm',
      bannerSubtitle: 'Nội dung hợp lệ',
      content: 'Tin ngắn',
      audience: 'ALL',
      status: 'PUBLISHED',
      isActive: true,
      isBannerActive: false,
      ...overrides,
    };

    const response = await handleAnnouncementRoutes(
      request('/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify(body),
      }, true),
      env(db),
      '/api/admin/announcements',
      'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(400);
    expect(payload.message).toContain(expectedMessage);
    expect(db.batches).toHaveLength(0);
  });

  it.each([
    ['empty content', { content: '   ', channels_json: '["TICKER"]' }, 'nội dung'],
    ['no channel', { channels_json: '[]' }, 'ít nhất một kênh'],
    ['urgent without critical strip', { priority: 'URGENT', channels_json: '["TICKER"]' }, 'Cảnh báo khẩn'],
    ['CTA without a safe link', { cta_label: 'Xem ngay', banner_link: '', channels_json: '["BANNER"]' }, 'liên kết'],
  ])('rejects publish action for saved draft with %s', async (_label, overrides, expectedMessage) => {
    const db = new FakeDatabase([
      announcement('invalid-draft', {
        status: 'DRAFT',
        ...overrides,
      }),
    ]);

    const response = await handleAnnouncementRoutes(
      request('/api/admin/announcements/invalid-draft/publish', {
        method: 'POST',
        body: JSON.stringify({ expectedUpdatedAt: '2026-07-24T01:00:00.000Z' }),
      }, true),
      env(db),
      '/api/admin/announcements/invalid-draft/publish',
      'POST',
    );
    const payload = await response.json() as any;

    expect(response.status).toBe(400);
    expect(payload.message).toContain(expectedMessage);
    expect(db.batches).toHaveLength(0);
  });
});
