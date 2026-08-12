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

import { handleLoginMediaRoutes } from '../workers/src/routes/loginMedia';

type FirstResolver = (sql: string, bindings: unknown[]) => unknown;
type AllResolver = (sql: string, bindings: unknown[]) => unknown[];

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
    if (this.db.failReads) throw new Error('D1_ERROR: simulated read failure');
    return (this.db.firstResolver?.(this.sql, this.bindings) ?? null) as T | null;
  }

  async all<T>() {
    if (this.db.failReads) throw new Error('D1_ERROR: simulated read failure');
    return { results: (this.db.allResolver?.(this.sql, this.bindings) ?? []) as T[] };
  }

  async run() {
    return { success: true, meta: { changes: 1 } };
  }
}

class FakeDatabase {
  readonly statements: FakeStatement[] = [];
  readonly batches: FakeStatement[][] = [];
  failReads = false;

  constructor(
    readonly firstResolver?: FirstResolver,
    readonly allResolver?: AllResolver,
  ) {}

  prepare(sql: string) {
    const statement = new FakeStatement(sql, this);
    this.statements.push(statement);
    return statement;
  }

  async batch(statements: FakeStatement[]) {
    this.batches.push(statements);
    return statements.map(() => ({ success: true, meta: { changes: 1 } }));
  }
}

const settings = (overrides: Record<string, unknown> = {}) => ({
  id: 'default',
  display_mode: 'SLIDER',
  autoplay: 1,
  interval_ms: 5000,
  transition: 'FADE',
  show_dots: 1,
  show_arrows: 1,
  pause_on_hover: 1,
  version: 3,
  updated_at: '2026-08-12T16:00:00.000Z',
  updated_by: 'admin-1',
  ...overrides,
});

const slide = (overrides: Record<string, unknown> = {}) => ({
  id: 'slide-1',
  cloudinary_public_id: 'tohieuquiz/login-media/2026/08/slide-1',
  image_url: 'https://res.cloudinary.com/demo/image/upload/v1/tohieuquiz/login-media/2026/08/slide-1.webp',
  image_width: 1200,
  image_height: 520,
  alt_text: 'Banner ôn tập',
  internal_title: 'Banner 1',
  link_url: '/practice',
  open_new_tab: 0,
  sort_order: 10,
  enabled: 1,
  starts_at: null,
  ends_at: null,
  created_at: '2026-08-12T15:00:00.000Z',
  created_by: 'admin-1',
  updated_at: '2026-08-12T15:00:00.000Z',
  updated_by: 'admin-1',
  ...overrides,
});

const env = (db: FakeDatabase) => ({
  DB: db,
  JWT_SECRET: 'test-secret',
}) as any;

const request = (path: string, init: RequestInit = {}) => new Request(`https://api.thtohieu.com${path}`, {
  ...init,
  headers: {
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers || {}),
  },
});

beforeEach(() => {
  vi.restoreAllMocks();
  currentUser = { id: 'admin-1', username: 'admin-1', role: 'admin' };
});

describe('login media public delivery', () => {
  it('returns only active public fields in slider mode', async () => {
    const db = new FakeDatabase(
      (sql) => sql.includes('FROM login_media_settings') ? settings() : null,
      (sql) => sql.includes('FROM login_media_slides') ? [slide()] : [],
    );

    const response = await handleLoginMediaRoutes(request('/api/login-media'), env(db), '/api/login-media', 'GET');
    const payload = await response!.json() as any;

    expect(response!.status).toBe(200);
    expect(payload.data.mode).toBe('SLIDER');
    expect(payload.data.slides).toEqual([{
      id: 'slide-1',
      imageUrl: expect.stringContaining('res.cloudinary.com'),
      alt: 'Banner ôn tập',
      linkUrl: '/practice',
      openNewTab: false,
    }]);
    expect(JSON.stringify(payload)).not.toContain('cloudinaryPublicId');
    expect(JSON.stringify(payload)).not.toContain('createdBy');
    const slideQuery = db.statements.find((statement) => statement.sql.includes('FROM login_media_slides'));
    expect(slideQuery?.sql).toContain('enabled = 1');
    expect(slideQuery?.sql).toContain('starts_at IS NULL');
    expect(slideQuery?.sql).toContain('ends_at IS NULL');
    expect(slideQuery?.sql).toContain('ORDER BY sort_order ASC');
  });

  it('drops unsafe stored images and links from the public payload', async () => {
    const db = new FakeDatabase(
      (sql) => sql.includes('FROM login_media_settings') ? settings() : null,
      (sql) => sql.includes('FROM login_media_slides') ? [
        slide({ id: 'unsafe-image', image_url: 'https://evil.example/banner.webp' }),
        slide({ id: 'unsafe-link', link_url: 'javascript:alert(1)' }),
        slide({ id: 'missing-link-alt', alt_text: '', link_url: '/practice', open_new_tab: 1 }),
      ] : [],
    );

    const response = await handleLoginMediaRoutes(request('/api/login-media'), env(db), '/api/login-media', 'GET');
    const payload = await response!.json() as any;

    expect(payload.data.slides).toHaveLength(2);
    expect(payload.data.slides[0]).toMatchObject({ id: 'unsafe-link', linkUrl: null, openNewTab: false });
    expect(payload.data.slides[1]).toMatchObject({ id: 'missing-link-alt', linkUrl: null, openNewTab: false });
  });

  it('degrades to CONTENT instead of failing the login page when D1 is unavailable', async () => {
    const db = new FakeDatabase();
    db.failReads = true;

    const response = await handleLoginMediaRoutes(request('/api/login-media'), env(db), '/api/login-media', 'GET');
    const payload = await response!.json() as any;

    expect(response!.status).toBe(200);
    expect(payload.data).toMatchObject({ mode: 'CONTENT', slides: [], degraded: true });
    expect(payload.data.settings.intervalMs).toBe(5000);
  });
});

describe('login media admin routes', () => {
  it('forbids a non-admin before reading management data', async () => {
    currentUser = { id: 'teacher-1', username: 'teacher-1', role: 'teacher' };
    const db = new FakeDatabase();

    const response = await handleLoginMediaRoutes(request('/api/admin/login-media'), env(db), '/api/admin/login-media', 'GET');

    expect(response!.status).toBe(403);
    expect(db.statements).toHaveLength(0);
  });

  it('returns settings version and full slide metadata to an admin', async () => {
    const db = new FakeDatabase(
      (sql) => sql.includes('FROM login_media_settings') ? settings() : null,
      (sql) => sql.includes('FROM login_media_slides') ? [slide()] : [],
    );

    const response = await handleLoginMediaRoutes(request('/api/admin/login-media'), env(db), '/api/admin/login-media', 'GET');
    const payload = await response!.json() as any;

    expect(response!.status).toBe(200);
    expect(payload.data.settings.version).toBe(3);
    expect(payload.data.slides[0]).toMatchObject({
      cloudinaryPublicId: 'tohieuquiz/login-media/2026/08/slide-1',
      internalTitle: 'Banner 1',
      enabled: true,
    });
  });

  it('updates settings with optimistic versioning and a conditional audit', async () => {
    const now = '2026-08-13T00:30:00.000Z';
    let settingsReads = 0;
    const db = new FakeDatabase((sql) => {
      if (!sql.includes('FROM login_media_settings')) return null;
      settingsReads += 1;
      return settingsReads === 1
        ? settings({ version: 3 })
        : settings({
          version: 4,
          interval_ms: 7000,
          updated_at: now,
          updated_by: 'admin-1',
        });
    });
    const dateSpy = vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(now);

    const response = await handleLoginMediaRoutes(request('/api/admin/login-media/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        expectedVersion: 3,
        displayMode: 'SLIDER',
        autoplay: true,
        intervalMs: 7000,
        transition: 'FADE',
        showDots: true,
        showArrows: true,
        pauseOnHover: true,
        reason: 'Đổi thời gian trình chiếu',
      }),
    }), env(db), '/api/admin/login-media/settings', 'PATCH');

    dateSpy.mockRestore();
    expect(response!.status).toBe(200);
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0][0].sql).toContain("WHERE id = 'default' AND version = ?");
    expect(db.batches[0][1].sql).toContain('updated_at = ? AND updated_by = ?');
  });

  it('returns 409 for stale settings updates and does not write', async () => {
    const db = new FakeDatabase(
      (sql) => sql.includes('FROM login_media_settings') ? settings({ version: 4 }) : null,
    );

    const response = await handleLoginMediaRoutes(request('/api/admin/login-media/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        expectedVersion: 3,
        displayMode: 'SLIDER',
        autoplay: true,
        intervalMs: 5000,
        transition: 'FADE',
        showDots: true,
        showArrows: true,
        pauseOnHover: true,
        reason: 'Đổi banner',
      }),
    }), env(db), '/api/admin/login-media/settings', 'PATCH');

    expect(response!.status).toBe(409);
    expect(db.batches).toHaveLength(0);
  });

  it('creates a disabled slide by default and records an audit batch', async () => {
    const db = new FakeDatabase();
    const response = await handleLoginMediaRoutes(request('/api/admin/login-media/slides', {
      method: 'POST',
      body: JSON.stringify({
        cloudinaryPublicId: 'tohieuquiz/login-media/2026/08/new-slide',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tohieuquiz/login-media/2026/08/new-slide.webp',
        imageWidth: 1200,
        imageHeight: 520,
        altText: 'Banner luyện tập',
        internalTitle: 'Banner mới',
        linkUrl: '/practice',
      }),
    }), env(db), '/api/admin/login-media/slides', 'POST');
    const payload = await response!.json() as any;

    expect(response!.status).toBe(201);
    expect(payload.data.enabled).toBe(false);
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0]).toHaveLength(2);
    expect(db.batches[0][0].bindings[10]).toBe(0);
  });

  it('updates a slide with expectedUpdatedAt and verifies the winning write', async () => {
    const now = '2026-08-13T00:40:00.000Z';
    let slideReads = 0;
    const db = new FakeDatabase((sql) => {
      if (!sql.includes('FROM login_media_slides')) return null;
      slideReads += 1;
      return slideReads === 1
        ? slide()
        : slide({
          internal_title: 'Banner đã sửa',
          updated_at: now,
          updated_by: 'admin-1',
        });
    });
    const dateSpy = vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(now);

    const response = await handleLoginMediaRoutes(request('/api/admin/login-media/slides/slide-1', {
      method: 'PUT',
      body: JSON.stringify({
        expectedUpdatedAt: '2026-08-12T15:00:00.000Z',
        cloudinaryPublicId: 'tohieuquiz/login-media/2026/08/slide-1',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tohieuquiz/login-media/2026/08/slide-1.webp',
        imageWidth: 1200,
        imageHeight: 520,
        altText: 'Banner ôn tập',
        internalTitle: 'Banner đã sửa',
        linkUrl: '/practice',
        openNewTab: false,
        sortOrder: 10,
        enabled: true,
      }),
    }), env(db), '/api/admin/login-media/slides/slide-1', 'PUT');

    dateSpy.mockRestore();
    expect(response!.status).toBe(200);
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0][0].sql).toContain('WHERE id = ? AND updated_at = ?');
    expect(db.batches[0][1].sql).toContain('updated_by = ?');
  });

  it('deletes a slide only when its expected timestamp still matches', async () => {
    let slideReads = 0;
    const db = new FakeDatabase((sql) => {
      if (!sql.includes('FROM login_media_slides')) return null;
      slideReads += 1;
      return slideReads === 1 ? slide() : null;
    });

    const response = await handleLoginMediaRoutes(request('/api/admin/login-media/slides/slide-1', {
      method: 'DELETE',
      body: JSON.stringify({ expectedUpdatedAt: '2026-08-12T15:00:00.000Z' }),
    }), env(db), '/api/admin/login-media/slides/slide-1', 'DELETE');

    expect(response!.status).toBe(200);
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0][0].sql).toContain('DELETE FROM login_media_slides');
    expect(db.batches[0][1].sql).toContain('WHERE NOT EXISTS');
  });

  it('reorders the exact current slide set in one audited batch', async () => {
    const db = new FakeDatabase(
      undefined,
      (sql) => sql.includes('SELECT id FROM login_media_slides')
        ? [{ id: 'slide-1' }, { id: 'slide-2' }]
        : [],
    );

    const response = await handleLoginMediaRoutes(request('/api/admin/login-media/slides/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ slideIds: ['slide-2', 'slide-1'], reason: 'Ưu tiên banner 2' }),
    }), env(db), '/api/admin/login-media/slides/reorder', 'PATCH');

    expect(response!.status).toBe(200);
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0]).toHaveLength(3);
    expect(db.batches[0][0].bindings[0]).toBe(10);
    expect(db.batches[0][0].bindings[3]).toBe('slide-2');
    expect(db.batches[0][1].bindings[0]).toBe(20);
    expect(db.batches[0][1].bindings[3]).toBe('slide-1');
  });

  it('rejects browser-normalized external-looking internal links and unsafe public ids', async () => {
    const db = new FakeDatabase();
    const unsafeLinkResponse = await handleLoginMediaRoutes(request('/api/admin/login-media/slides', {
      method: 'POST',
      body: JSON.stringify({
        cloudinaryPublicId: 'tohieuquiz/login-media/2026/08/unsafe-link',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tohieuquiz/login-media/2026/08/unsafe-link.webp',
        altText: 'Banner',
        linkUrl: '/\\evil.example',
      }),
    }), env(db), '/api/admin/login-media/slides', 'POST');
    const unsafeIdResponse = await handleLoginMediaRoutes(request('/api/admin/login-media/slides', {
      method: 'POST',
      body: JSON.stringify({
        cloudinaryPublicId: 'tohieuquiz/login-media/../unsafe-id',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tohieuquiz/login-media/unsafe-id.webp',
        altText: 'Banner',
      }),
    }), env(db), '/api/admin/login-media/slides', 'POST');

    expect(unsafeLinkResponse!.status).toBe(400);
    expect(unsafeIdResponse!.status).toBe(400);
    expect(db.batches).toHaveLength(0);
  });

  it('rejects clickable slides without accessible alt text', async () => {
    const db = new FakeDatabase();
    const response = await handleLoginMediaRoutes(request('/api/admin/login-media/slides', {
      method: 'POST',
      body: JSON.stringify({
        cloudinaryPublicId: 'tohieuquiz/login-media/2026/08/no-alt',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tohieuquiz/login-media/2026/08/no-alt.webp',
        linkUrl: '/practice',
        altText: '',
      }),
    }), env(db), '/api/admin/login-media/slides', 'POST');

    expect(response!.status).toBe(400);
    expect(db.batches).toHaveLength(0);
  });

  it('rejects invalid carousel intervals before writing settings', async () => {
    const db = new FakeDatabase();
    const response = await handleLoginMediaRoutes(request('/api/admin/login-media/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        expectedVersion: 1,
        displayMode: 'SLIDER',
        autoplay: true,
        intervalMs: 1000,
        transition: 'FADE',
        showDots: true,
        showArrows: true,
        pauseOnHover: true,
        reason: 'Quá nhanh',
      }),
    }), env(db), '/api/admin/login-media/settings', 'PATCH');

    expect(response!.status).toBe(400);
    expect(db.batches).toHaveLength(0);
  });

  it('rejects duplicate reorder ids before writing', async () => {
    const db = new FakeDatabase();
    const response = await handleLoginMediaRoutes(request('/api/admin/login-media/slides/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ slideIds: ['slide-1', 'slide-1'], reason: 'Sai thứ tự' }),
    }), env(db), '/api/admin/login-media/slides/reorder', 'PATCH');

    expect(response!.status).toBe(400);
    expect(db.batches).toHaveLength(0);
  });
});
