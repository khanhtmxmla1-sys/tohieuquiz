import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  RATE_LIMIT_RETENTION_MS,
  purgeExpiredRateLimits,
  rateLimit,
} from '../workers/src/middleware/rateLimit';

class FakeStatement {
  bindings: unknown[] = [];
  constructor(
    readonly sql: string,
    private readonly firstResult: unknown,
    private readonly shouldThrow = false,
    private readonly changes = 0,
  ) {}
  bind(...values: unknown[]) {
    this.bindings = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    if (this.shouldThrow) throw new Error('D1 unavailable');
    return this.firstResult as T | null;
  }
  async run() {
    if (this.shouldThrow) throw new Error('D1 unavailable');
    return { success: true, meta: { changes: this.changes } };
  }
}

function createEnv(firstResult: unknown, shouldThrow = false, changes = 0) {
  const statements: FakeStatement[] = [];
  const DB = {
    prepare: vi.fn((sql: string) => {
      const statement = new FakeStatement(sql, firstResult, shouldThrow, changes);
      statements.push(statement);
      return statement;
    }),
  };
  return { env: { DB } as any, statements, DB };
}

describe('D1 rate limiter', () => {
  it('uses the aggregate production schema and allows requests inside the limit', async () => {
    const { env, statements } = createEnv({ count: 1, window_start: new Date().toISOString() });
    const request = new Request('https://example.com/api/login', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });

    const response = await rateLimit(request, env, { windowMs: 300_000, maxRequests: 5 });

    expect(response).toBeNull();
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toContain('INSERT INTO rate_limits (key, count, window_start, updated_at)');
    expect(statements[0].sql).toContain('ON CONFLICT(key) DO UPDATE');
    expect(statements[0].sql).toContain('RETURNING count, window_start');
    expect(statements[0].sql).not.toContain('created_at');
    expect(statements[0].bindings[0]).toBe('ratelimit:POST:/api/login:1.2.3.4');
  });

  it('returns 429 after the maximum request count is exceeded', async () => {
    const { env } = createEnv({ count: 6, window_start: new Date().toISOString() });
    const response = await rateLimit(
      new Request('https://example.com/api/login', { method: 'POST' }),
      env,
      { maxRequests: 5 },
    );

    expect(response?.status).toBe(429);
    await expect(response?.json()).resolves.toMatchObject({
      status: 'error',
      message: expect.stringMatching(/too many requests/i),
    });
  });

  it('supports an explicit key generator', async () => {
    const { env, statements } = createEnv({ count: 1, window_start: new Date().toISOString() });
    await rateLimit(
      new Request('https://example.com/api/ai/generate', { method: 'POST' }),
      env,
      { keyGenerator: () => 'custom:user-1' },
    );

    expect(statements[0].bindings[0]).toBe('custom:user-1');
  });

  it('fails open when D1 is unavailable by default', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { env } = createEnv(null, true);

    await expect(rateLimit(new Request('https://example.com/api/public'), env)).resolves.toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('fails closed with a retryable 503 for sensitive routes', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { env } = createEnv(null, true);

    const response = await rateLimit(
      new Request('https://example.com/api/ai/chat', { method: 'POST' }),
      env,
      { failureMode: 'closed' },
    );

    expect(response?.status).toBe(503);
    expect(response?.headers.get('Retry-After')).toBe('60');
    await expect(response?.json()).resolves.toMatchObject({
      status: 'error',
      message: expect.stringMatching(/temporarily unavailable/i),
    });
    consoleSpy.mockRestore();
  });

  it('prefers the Cloudflare client IP over spoofable forwarding headers', async () => {
    const { env, statements } = createEnv({ count: 1, window_start: new Date().toISOString() });
    await rateLimit(new Request('https://example.com/api/login', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '1.2.3.4',
        'X-Forwarded-For': '9.9.9.9',
      },
    }), env);

    expect(statements[0].bindings[0]).toBe('ratelimit:POST:/api/login:1.2.3.4');
  });

  it('writes only columns that the deployed table actually has', () => {
    // Trước đây hình dạng bảng được canh bằng `ensureRateLimitTable()` — một hàm không ai gọi,
    // nên nó vẫn "xanh" trong lúc production hoàn toàn không có bảng và mọi lượt đăng nhập trả 503.
    // Giờ canh trực tiếp vào hai nguồn tạo bảng thật: schema (DB mới) và migration (DB đang chạy).
    const columns = ['key', 'count', 'window_start', 'updated_at'];
    const schema = readFileSync('workers/schema.sql', 'utf8');
    const migration = readFileSync('workers/migrations/0043_create_rate_limits.sql', 'utf8');
    const runtime = readFileSync('workers/src/middleware/rateLimit.ts', 'utf8');

    for (const source of [schema, migration]) {
      const table = /CREATE TABLE IF NOT EXISTS rate_limits\s*\(([^;]*?)\)\s*;/i.exec(source);
      expect(table, 'khai báo bảng rate_limits').not.toBeNull();
      for (const column of columns) expect(table![1]).toContain(column);
      expect(table![1]).not.toContain('created_at');
    }

    expect(runtime).toContain('INSERT INTO rate_limits (key, count, window_start, updated_at)');
  });
});

describe('rate limit retention', () => {
  it('deletes only rows whose window closed before the retention cutoff', async () => {
    const { env, statements } = createEnv(null, false, 7);
    const now = new Date('2026-07-26T12:00:00.000Z');

    const purged = await purgeExpiredRateLimits(env.DB as any, now);

    expect(purged).toBe(7);
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toBe('DELETE FROM rate_limits WHERE window_start <= ?');
    expect(statements[0].bindings).toEqual([
      new Date(now.getTime() - RATE_LIMIT_RETENTION_MS).toISOString(),
    ]);
  });

  it('keeps rows for longer than the widest limiter window', () => {
    const widestWindowMs = 15 * 60 * 1000; // utils/loginRateLimit.ts
    expect(RATE_LIMIT_RETENTION_MS).toBeGreaterThan(widestWindowMs);
  });

  it('reports zero when D1 gives no change count', async () => {
    const { env } = createEnv(null);
    await expect(purgeExpiredRateLimits(env.DB as any, new Date())).resolves.toBe(0);
  });
});
