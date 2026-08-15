import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async () => ({
    user: { id: 'admin-1', username: 'admin-1', role: 'admin', school_id: 'school-1' },
  })),
  requireAdmin: vi.fn(() => true),
}));

import { handleAdminCertificateRoutes } from '../workers/src/routes/adminCertificates';

class AdminStatement {
  bindings: unknown[] = [];
  constructor(readonly sql: string, readonly db: AdminDB) {}
  bind(...values: unknown[]) { this.bindings = values; return this; }
  run() { this.db.runs.push(this); return Promise.resolve({ success: true }); }
  all<T>() { return Promise.resolve({ results: [] as T[] }); }
}

class AdminDB {
  runs: AdminStatement[] = [];
  statements: AdminStatement[] = [];
  prepare(sql: string) {
    const statement = new AdminStatement(sql, this);
    this.statements.push(statement);
    return statement;
  }
}

const env = (db: AdminDB) => ({ DB: db } as any);

describe('admin certificate template runtime validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects malformed fields_config before writing D1', async () => {
    const db = new AdminDB();
    const response = await handleAdminCertificateRoutes(
      new Request('https://example.test/api/admin/certificate-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mẫu 1',
          bg_image_r2_key: 'templates/bg.png',
          fields_config: '{not-json',
        }),
      }),
      env(db),
      '/api/admin/certificate-templates',
      'POST',
    );

    expect(response?.status).toBe(400);
    expect(db.runs).toHaveLength(0);
  });

  it('rejects invalid canvas dimensions and boolean flags on patch', async () => {
    const db = new AdminDB();
    const response = await handleAdminCertificateRoutes(
      new Request('https://example.test/api/admin/certificate-templates/template-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvas_width: -1, is_default: 7 }),
      }),
      env(db),
      '/api/admin/certificate-templates/template-1',
      'PATCH',
    );

    expect(response?.status).toBe(400);
    expect(db.runs).toHaveLength(0);
  });
});
