import { describe, expect, it, vi } from 'vitest';
import { handleOperationsRoutes } from '../workers/src/routes/operations';

vi.mock('../workers/src/middleware/jwtAuth', () => ({
  verifyJWTMiddleware: vi.fn(async (request: Request) => ({
    user: {
      username: request.headers.get('x-user') || 'teacher-a',
      role: request.headers.get('x-role') || 'teacher',
      tokenVersion: 1,
    },
  })),
  requireAdmin: vi.fn((user: { role: string }) => user.role === 'admin'),
}));

class Statement {
  constructor(private readonly sql: string) {}
  bind() { return this; }
  async first<T>() {
    if (this.sql.includes('SELECT 1 AS count')) return { count: 1 } as T;
    if (this.sql.includes('FROM d1_migrations')) return { count: 61, latest: '0062_add_question_svg_diagrams.sql' } as T;
    if (this.sql.includes('FROM certificate_batches')) return {
      pending_count: 0, processing_count: 0, failed_count: 0, stale_processing_count: 0,
    } as T;
    if (this.sql.includes('FROM ai_generation_actions')) return {
      total_count: 0, failed_count: 0, reserved_count: 0,
    } as T;
    return null as T;
  }
  async all<T>() {
    return { results: [
      { setting_key: 'ai_assistant_enabled', setting_value: 'true' },
      { setting_key: 'unified_notifications_v1', setting_value: 'true' },
    ] as T[] };
  }
}

const env = {
  DB: { prepare: (sql: string) => new Statement(sql) },
  CERTIFICATE_QUEUE: {},
  CERT_IMAGES: { head: async () => null },
  OG_IMAGES: { head: async () => null },
  AI_GATEWAY: {},
} as any;

describe('admin operations route', () => {
  it('rejects non-admin staff', async () => {
    const response = await handleOperationsRoutes(
      new Request('https://api.test/api/admin/operations', { headers: { 'x-role': 'teacher' } }),
      env,
      '/api/admin/operations',
      'GET',
    );
    expect(response?.status).toBe(403);
  });

  it('returns a no-store snapshot to admins without secret fields', async () => {
    const response = await handleOperationsRoutes(
      new Request('https://api.test/api/admin/operations', { headers: { 'x-role': 'admin', 'x-request-id': 'req-ops-route' } }),
      env,
      '/api/admin/operations',
      'GET',
    );
    const payload = await response?.json() as any;
    expect(response?.status).toBe(200);
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(payload.data.requestId).toBe('req-ops-route');
    expect(payload.data.components).toHaveLength(10);
    expect(payload.data.components.find((item: any) => item.id === 'migrations')).toMatchObject({
      status: 'healthy',
      metrics: [
        { key: 'appliedCount', value: 61 },
        { key: 'latestIsExpected', value: true },
      ],
    });
    expect(JSON.stringify(payload)).not.toMatch(/token|secret|bindingId|databaseId/i);
  });
});
