import { describe, expect, it, vi } from 'vitest';
import { ensureRateLimitTable, rateLimit } from '../workers/src/middleware/rateLimit';

class FakeStatement {
  bindings: unknown[] = [];
  constructor(
    readonly sql: string,
    private readonly firstResult: unknown,
    private readonly shouldThrow = false,
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
    return { success: true };
  }
}

function createEnv(firstResult: unknown, shouldThrow = false) {
  const statements: FakeStatement[] = [];
  const DB = {
    prepare: vi.fn((sql: string) => {
      const statement = new FakeStatement(sql, firstResult, shouldThrow);
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

  it('creates the same aggregate table shape used by production', async () => {
    const { env, statements } = createEnv(null);
    await ensureRateLimitTable(env.DB as any);

    expect(statements[0].sql).toContain('key TEXT PRIMARY KEY');
    expect(statements[0].sql).toContain('count INTEGER NOT NULL');
    expect(statements[0].sql).toContain('window_start TEXT NOT NULL');
    expect(statements[0].sql).toContain('updated_at TEXT NOT NULL');
    expect(statements[0].sql).not.toContain('created_at');
  });
});
