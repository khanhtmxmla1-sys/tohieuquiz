import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const rateLimitMock = vi.hoisted(() => vi.fn(async () => null as Response | null));

vi.mock('../workers/src/routes/certificates', () => ({
  createBatch: vi.fn(),
  getBatches: vi.fn(),
  getBatchDetail: vi.fn(),
  preview: vi.fn(),
  uploadTemplate: vi.fn(),
  getTemplates: vi.fn(),
  getMyCertificates: vi.fn(),
  handleCertificateRoutes: vi.fn(async () => null),
}));

vi.mock('../workers/src/routes/adminCertificates', () => ({
  handleAdminCertificateRoutes: vi.fn(async () => null),
}));

vi.mock('../workers/src/routes/phieu', () => ({
  handlePhieuSubdomain: vi.fn(async () => null),
  handlePublicPhieuApi: vi.fn(async () => null),
  handlePhieuRoutes: vi.fn(async () => null),
}));

vi.mock('../workers/src/middleware/rateLimit', () => ({
  rateLimit: rateLimitMock,
}));

let worker: typeof import('../workers/src/index').default;

beforeAll(async () => {
  worker = (await import('../workers/src/index')).default;
});

beforeEach(() => {
  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue(null);
});

const env = {
  ENVIRONMENT: 'production',
  ALLOWED_ORIGINS: 'https://www.thtohieu.com,https://phuhuynh.thtohieu.com',
  JWT_SECRET: 'test-secret',
  DB: {
    prepare() {
      throw new Error('D1 should not be reached before authentication');
    },
  },
} as any;

const request = (
  path: string,
  method: 'GET' | 'POST' = 'GET',
  origin = method === 'POST' ? 'https://www.thtohieu.com' : undefined,
) => new Request(`https://api.thtohieu.com${path}`, {
  method,
  headers: method === 'POST' ? {
    'Content-Type': 'application/json',
    ...(origin ? { Origin: origin } : {}),
  } : undefined,
  body: method === 'POST' ? '{}' : undefined,
});

const unavailable = () => new Response(JSON.stringify({ status: 'error', message: 'unavailable' }), {
  status: 503,
  headers: { 'Content-Type': 'application/json' },
});

describe('Worker root route dispatch', () => {
  it('dispatches parent portal routes before the shared authentication fallback', async () => {
    const source = await import('../workers/src/index?raw');
    const parentRoute = source.default.indexOf('handleParentPortalRoutes(request, env, path, method)');
    const sharedAuth = source.default.indexOf('const authError = verifyToken(request, env)');

    expect(parentRoute).toBeGreaterThan(-1);
    expect(sharedAuth).toBeGreaterThan(parentRoute);

    const response = await worker.fetch(request('/api/parent-links'), env);
    expect(response.status).toBe(401);
  });

  it('registers manual quiz drafts before the broader quiz routes', async () => {
    const source = await import('../workers/src/index?raw');
    const draftRoute = source.default.indexOf("path.startsWith('/api/quiz-drafts/')");
    const quizRoute = source.default.indexOf("path.startsWith('/api/quizzes')");

    expect(draftRoute).toBeGreaterThan(-1);
    expect(quizRoute).toBeGreaterThan(draftRoute);
    expect(source.default).toContain('handleQuizDraftRoutes(request, env, path, method)');
  });

  it('routes the read-only math monitor before legacy handlers', async () => {
    const response = await worker.fetch(request('/api/admin/math-audit/issues?limit=1'), env);
    expect(response.status).toBe(401);
  });

  it('routes the disabled bulk-repair endpoint before legacy handlers', async () => {
    const response = await worker.fetch(request('/api/admin/math-audit/apply', 'POST'), env);
    expect(response.status).toBe(401);
  });

  it('still routes gamification mutations to JWT authentication', async () => {
    const response = await worker.fetch(request('/api/game-state', 'POST'), env);
    expect(response.status).toBe(401);
  });

  it('blocks an unsafe request from an untrusted origin before auth and routing', async () => {
    const response = await worker.fetch(request('/api/game-state', 'POST', 'https://evil.example'), env);
    expect(response.status).toBe(403);
    expect(rateLimitMock).not.toHaveBeenCalled();
  });

  it('authenticates AI endpoints before applying the role-aware limiter', async () => {
    rateLimitMock.mockResolvedValueOnce(unavailable());
    const response = await worker.fetch(request('/api/ai/chat', 'POST'), env);

    expect(response.status).toBe(401);
    expect(rateLimitMock).not.toHaveBeenCalled();
  });

  it('fails closed for parent activation and login when limiter storage is unavailable', async () => {
    rateLimitMock.mockResolvedValueOnce(unavailable());
    const response = await worker.fetch(request('/api/parent/login', 'POST'), env);

    expect(response.status).toBe(503);
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      expect.objectContaining({
        windowMs: 5 * 60 * 1000,
        maxRequests: 10,
        failureMode: 'closed',
      }),
    );
  });

  it('fails closed for student login when limiter storage is unavailable', async () => {
    rateLimitMock.mockResolvedValueOnce(unavailable());
    const response = await worker.fetch(request('/api/student-login', 'POST'), env);

    expect(response.status).toBe(503);
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      expect.objectContaining({ failureMode: 'closed', maxRequests: 20 }),
    );
  });

  it('fails closed for legacy admin teacher mutations', async () => {
    rateLimitMock.mockResolvedValueOnce(unavailable());
    const response = await worker.fetch(request('/api/teachers', 'POST'), env);

    expect(response.status).toBe(503);
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      expect.objectContaining({ failureMode: 'closed', maxRequests: 30 }),
    );
  });

  it('keeps public read rate limiting fail open by default', async () => {
    const response = await worker.fetch(request('/api/phieu/public/sample'), env);
    expect(response.status).toBe(404);
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      expect.not.objectContaining({ failureMode: 'closed' }),
    );
  });
});
