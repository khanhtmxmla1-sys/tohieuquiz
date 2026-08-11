// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWTPayload } from '../workers/src/utils/jwt';

let currentUser: JWTPayload = { id: 'admin-1', username: 'admin-1', role: 'admin' };

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({ user: currentUser })),
  requireAdmin: vi.fn((user: JWTPayload) => user.role === 'admin'),
}));

import { handleAnnouncementRoutes } from '../workers/src/routes/announcements';

type Row = Record<string, unknown> & { id: string };

const row = (overrides: Partial<Row> = {}): Row => ({
  id: 'a-1',
  content: 'Thông báo hợp lệ',
  is_active: 'true',
  updated_at: '2026-08-11T01:00:00.000Z',
  banner_title: '',
  banner_subtitle: '',
  banner_link: '',
  banner_image: '',
  is_banner_active: 'false',
  days_to_live: 7,
  status: 'DRAFT',
  audience: 'ALL',
  starts_at: null,
  ends_at: null,
  created_by: 'admin-1',
  updated_by: 'admin-1',
  created_at: '2026-08-11T00:00:00.000Z',
  priority: 'INFO',
  channels_json: '["TICKER"]',
  dismissible: 1,
  cta_label: null,
  surface_overrides_json: '{}',
  ...overrides,
});

class Statement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, private readonly db: FakeDb) {}
  bind(...bindings: unknown[]) { this.bindings = bindings; return this; }
  async first<T>() { return (this.db.rows[0] ?? null) as T | null; }
  async all<T>() { return { results: this.db.rows as T[] }; }
  async run() { return { success: true, meta: { changes: 1 } }; }
}

class FakeDb {
  statements: Statement[] = [];
  batches: Statement[][] = [];
  constructor(readonly rows: Row[]) {}
  prepare(sql: string) { const statement = new Statement(sql, this); this.statements.push(statement); return statement; }
  async batch(statements: Statement[]) { this.batches.push(statements); return statements.map(() => ({ success: true })); }
}

const env = (db: FakeDb) => ({ DB: db, JWT_SECRET: 'test-secret' }) as any;
const request = (path: string) => new Request(`https://api.thtohieu.com${path}`, {
  method: 'POST',
  headers: { Cookie: 'auth_token=test-token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ expectedUpdatedAt: '2026-08-11T01:00:00.000Z' }),
});

const invoke = (db: FakeDb, action: 'publish' | 'cancel' | 'archive' | 'end') => handleAnnouncementRoutes(
  request(`/api/admin/announcements/a-1/${action}`),
  env(db),
  `/api/admin/announcements/a-1/${action}`,
  'POST',
);

describe('announcement lifecycle worker actions', () => {
  beforeEach(() => {
    currentUser = { id: 'admin-1', username: 'admin-1', role: 'admin' };
  });

  it('keeps a validated scheduled record scheduled when publish action activates it', async () => {
    const db = new FakeDb([row({
      status: 'SCHEDULED',
      starts_at: '2026-08-12T01:30:00.000Z',
    })]);

    const response = await invoke(db, 'publish');
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('SCHEDULED');
    expect(db.batches).toHaveLength(1);
    expect(db.batches[0][0].bindings[0]).toBe('SCHEDULED');
    expect(db.batches[0][0].bindings[1]).toBe('2026-08-12T01:30:00.000Z');
  });

  it('ends a published announcement as EXPIRED and records the end timestamp', async () => {
    const db = new FakeDb([row({ status: 'PUBLISHED', starts_at: '2026-08-11T00:30:00.000Z' })]);

    const response = await invoke(db, 'end');
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('EXPIRED');
    expect(db.batches).toHaveLength(1);
    const update = db.batches[0][0];
    expect(update.sql).toContain('ends_at');
    expect(update.bindings[0]).toBe('EXPIRED');
    expect(typeof update.bindings[2]).toBe('string');
  });

  it('retains cancel as the scheduled-to-draft contract and archive as readonly history', async () => {
    const scheduledDb = new FakeDb([row({ status: 'SCHEDULED' })]);
    const cancelResponse = await invoke(scheduledDb, 'cancel');
    expect((await cancelResponse.json() as any).data.status).toBe('DRAFT');

    const archiveDb = new FakeDb([row({ status: 'DRAFT' })]);
    const archiveResponse = await invoke(archiveDb, 'archive');
    expect((await archiveResponse.json() as any).data.status).toBe('ARCHIVED');
  });
});
