import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCors, corsHeaders } from '../workers/src/middleware/cors';
import { enforceOriginGuard } from '../workers/src/middleware/originGuard';
import { errorResponse, jsonResponse } from '../workers/src/utils/response';
import { internalErrorResponse } from '../workers/src/utils/internalError';
import {
  createWorkerFetch,
  type WorkerFetchDependencies,
} from '../workers/src/router/createWorkerFetch';

const rateLimitMock = vi.fn(async () => null as Response | null);
const verifyTokenMock = vi.fn(() => unauthorized());

const routeMocks = {
  handleTeacherRoutes: vi.fn(async () => null as Response | null),
  handleSecurityCenterRoutes: vi.fn(async () => null as Response | null),
  handlePasskeyRoutes: vi.fn(async () => null as Response | null),
  handleLogoutRoute: vi.fn(async () => null as Response | null),
  handleQuizDraftRoutes: vi.fn(async () => null as Response | null),
  handleQuizRoutes: vi.fn(async () => null as Response | null),
  handleResultRoutes: vi.fn(async () => null as Response | null),
  handleClassroomRoutes: vi.fn(async () => null as Response | null),
  handleGamificationRoutes: vi.fn(async () => null as Response | null),
  handleAnnouncementRoutes: vi.fn(async () => null as Response | null),
  handleAiTutorRoutes: vi.fn(async () => null as Response | null),
  handleAiProxy: vi.fn(async () => null as Response | null),
  handlePracticeRoutes: vi.fn(async () => null as Response | null),
  handleGiftShopRoutes: vi.fn(async () => null as Response | null),
  handleGameLoopRoutes: vi.fn(async () => null as Response | null),
  handleHelpRagRoutes: vi.fn(async () => null as Response | null),
  handleSystemSettingsRoutes: vi.fn(async () => null as Response | null),
  handleResultReportRoutes: vi.fn(async () => null as Response | null),
  handlePhieuRoutes: vi.fn(async () => null as Response | null),
  handleHomeworkRoutes: vi.fn(async () => null as Response | null),
  handleAnalyticsRoutes: vi.fn(async () => null as Response | null),
  handleTestBankRoutes: vi.fn(async () => null as Response | null),
  handleTeacherAiQuotaRoutes: vi.fn(async () => null as Response | null),
  handleLiveExamRoutes: vi.fn(async () => null as Response | null),
  handleNotificationRoutes: vi.fn(async () => null as Response | null),
  handleCertificateRoutes: vi.fn(async () => null as Response | null),
  handleAdminCertificateRoutes: vi.fn(async () => null as Response | null),
  handleMathObservabilityRoutes: vi.fn(async () => null as Response | null),
  handleClientErrorRoute: vi.fn(async () => null as Response | null),
  handleClientTelemetryRoute: vi.fn(async () => null as Response | null),
  handleActionCenterRoutes: vi.fn(async () => null as Response | null),
  handleOperationsRoutes: vi.fn(async () => null as Response | null),
  handlePhieuSubdomain: vi.fn(async () => null as Response | null),
  handlePublicPhieuApi: vi.fn(async () => null as Response | null),
  handleParentPortalRoutes: vi.fn(async () => unauthorized()),
};

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

function unauthorized() {
  return new Response(JSON.stringify({ status: 'error', message: 'unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

const unavailable = () => new Response(JSON.stringify({ status: 'error', message: 'unavailable' }), {
  status: 503,
  headers: { 'Content-Type': 'application/json' },
});

const structuredLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
let workerFetch: ReturnType<typeof createWorkerFetch>;

beforeEach(() => {
  structuredLogger.info.mockReset();
  structuredLogger.warn.mockReset();
  structuredLogger.error.mockReset();
  rateLimitMock.mockReset();
  rateLimitMock.mockResolvedValue(null);
  verifyTokenMock.mockReset();
  verifyTokenMock.mockReturnValue(unauthorized());

  for (const [name, mock] of Object.entries(routeMocks)) {
    mock.mockReset();
    mock.mockResolvedValue(name === 'handleParentPortalRoutes' ? unauthorized() : null);
  }

  const dependencies: WorkerFetchDependencies = {
    handleCors,
    corsHeaders,
    enforceOriginGuard,
    verifyToken: verifyTokenMock,
    jsonResponse,
    errorResponse,
    internalErrorResponse,
    rateLimit: rateLimitMock,
    logger: structuredLogger,
    now: vi.fn()
      .mockReturnValueOnce(1_000)
      .mockReturnValue(1_025),
    ...routeMocks,
  };

  workerFetch = createWorkerFetch(dependencies);
});

describe('Worker root route dispatch', () => {
  it('adds request correlation and a structured completion event', async () => {
    const response = await workerFetch(new Request('https://api.thtohieu.com/api/health', {
      headers: { 'x-request-id': 'req-health-1' },
    }), env);

    expect(response.headers.get('x-request-id')).toBe('req-health-1');
    expect(structuredLogger.info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(structuredLogger.info.mock.calls[0][0]))).toEqual({
      event: 'worker_request_completed',
      requestId: 'req-health-1',
      route: '/api/health',
      routeTemplate: '/api/health',
      method: 'GET',
      status: 200,
      durationMs: 25,
      roleCategory: 'public',
    });
  });

  it('accepts client error reports before shared authentication with a fail-closed limiter', async () => {
    routeMocks.handleClientErrorRoute.mockResolvedValueOnce(new Response('{}', { status: 202 }));

    const response = await workerFetch(request('/api/client-errors', 'POST'), env);

    expect(response.status).toBe(202);
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      expect.objectContaining({ failureMode: 'closed', maxRequests: 30 }),
    );
    expect(routeMocks.handleClientErrorRoute).toHaveBeenCalledOnce();
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it('accepts sampled client telemetry before shared authentication with a fail-closed limiter', async () => {
    routeMocks.handleClientTelemetryRoute.mockResolvedValueOnce(new Response('{}', { status: 202 }));

    const response = await workerFetch(request('/api/client-telemetry', 'POST'), env);

    expect(response.status).toBe(202);
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      expect.objectContaining({ failureMode: 'closed', maxRequests: 60 }),
    );
    expect(routeMocks.handleClientTelemetryRoute).toHaveBeenCalledOnce();
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it('dispatches parent portal routes before the shared authentication fallback', async () => {
    routeMocks.handleParentPortalRoutes.mockResolvedValueOnce(unauthorized());

    const response = await workerFetch(request('/api/parent-links'), env);

    expect(response.status).toBe(401);
    expect(routeMocks.handleParentPortalRoutes).toHaveBeenCalledOnce();
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it('registers manual quiz drafts before the broader quiz routes', async () => {
    verifyTokenMock.mockReturnValue(null);
    routeMocks.handleQuizDraftRoutes.mockResolvedValueOnce(new Response('draft'));

    const response = await workerFetch(request('/api/quiz-drafts/draft-1'), env);

    expect(response.status).toBe(200);
    expect(routeMocks.handleQuizDraftRoutes).toHaveBeenCalledOnce();
    expect(routeMocks.handleQuizRoutes).not.toHaveBeenCalled();
  });

  it('routes the read-only math monitor before legacy handlers', async () => {
    routeMocks.handleMathObservabilityRoutes.mockResolvedValueOnce(unauthorized());

    const response = await workerFetch(request('/api/admin/math-audit/issues?limit=1'), env);

    expect(response.status).toBe(401);
    expect(routeMocks.handleMathObservabilityRoutes).toHaveBeenCalledOnce();
    expect(routeMocks.handlePhieuSubdomain).not.toHaveBeenCalled();
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it('routes the disabled bulk-repair endpoint before legacy handlers', async () => {
    routeMocks.handleMathObservabilityRoutes.mockResolvedValueOnce(unauthorized());

    const response = await workerFetch(request('/api/admin/math-audit/apply', 'POST'), env);

    expect(response.status).toBe(401);
    expect(routeMocks.handleMathObservabilityRoutes).toHaveBeenCalledOnce();
    expect(routeMocks.handlePhieuSubdomain).not.toHaveBeenCalled();
  });

  it('still routes gamification mutations to JWT authentication', async () => {
    const response = await workerFetch(request('/api/game-state', 'POST'), env);

    expect(response.status).toBe(401);
    expect(verifyTokenMock).toHaveBeenCalledOnce();
    expect(routeMocks.handleGamificationRoutes).not.toHaveBeenCalled();
  });

  it('blocks an unsafe request from an untrusted origin before auth and routing', async () => {
    const response = await workerFetch(request('/api/game-state', 'POST', 'https://evil.example'), env);

    expect(response.status).toBe(403);
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(verifyTokenMock).not.toHaveBeenCalled();
  });

  it('authenticates AI endpoints before applying the role-aware limiter', async () => {
    rateLimitMock.mockResolvedValueOnce(unavailable());

    const response = await workerFetch(request('/api/ai/chat', 'POST'), env);

    expect(response.status).toBe(401);
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(routeMocks.handleAiProxy).not.toHaveBeenCalled();
  });

  it('fails closed for parent activation and login when limiter storage is unavailable', async () => {
    rateLimitMock.mockResolvedValueOnce(unavailable());

    const response = await workerFetch(request('/api/parent/login', 'POST'), env);

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

    const response = await workerFetch(request('/api/student-login', 'POST'), env);

    expect(response.status).toBe(503);
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      expect.objectContaining({ failureMode: 'closed', maxRequests: 20 }),
    );
  });

  it('dispatches the admin operations endpoint through the authenticated route chain', async () => {
    verifyTokenMock.mockReturnValueOnce(null);
    routeMocks.handleOperationsRoutes.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const response = await workerFetch(request('/api/admin/operations'), env);

    expect(response.status).toBe(200);
    expect(routeMocks.handleOperationsRoutes).toHaveBeenCalledWith(
      expect.any(Request), env, '/api/admin/operations', 'GET',
    );
  });

  it('dispatches passkey routes before the teacher account handler', async () => {
    verifyTokenMock.mockReturnValueOnce(null);
    routeMocks.handlePasskeyRoutes.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const response = await workerFetch(request('/api/account/passkeys'), env);

    expect(response.status).toBe(200);
    expect(routeMocks.handlePasskeyRoutes).toHaveBeenCalledWith(
      expect.any(Request), env, '/api/account/passkeys', 'GET',
    );
    expect(routeMocks.handleTeacherRoutes).not.toHaveBeenCalled();
  });

  it('dispatches account session routes before the teacher account handler', async () => {
    verifyTokenMock.mockReturnValueOnce(null);
    routeMocks.handleSecurityCenterRoutes.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const response = await workerFetch(request('/api/account/sessions'), env);

    expect(response.status).toBe(200);
    expect(routeMocks.handleSecurityCenterRoutes).toHaveBeenCalledWith(
      expect.any(Request), env, '/api/account/sessions', 'GET',
    );
    expect(routeMocks.handleTeacherRoutes).not.toHaveBeenCalled();
  });

  it('fails closed for legacy admin teacher mutations', async () => {
    rateLimitMock.mockResolvedValueOnce(unavailable());

    const response = await workerFetch(request('/api/teachers', 'POST'), env);

    expect(response.status).toBe(503);
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      expect.objectContaining({ failureMode: 'closed', maxRequests: 30 }),
    );
  });

  it('keeps public read rate limiting fail open by default', async () => {
    verifyTokenMock.mockReturnValue(null);

    const response = await workerFetch(request('/api/phieu/public/sample'), env);

    expect(response.status).toBe(404);
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      env,
      expect.not.objectContaining({ failureMode: 'closed' }),
    );
  });
});
