import type { Env } from '../types';
import { getRequestId, logStructured, withRequestId, type StructuredLogSink } from '../utils/logger';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  failureMode?: 'open' | 'closed';
}

type RouteHandler = (
  request: Request,
  env: Env,
  path: string,
  method: string,
) => Promise<Response | null>;

type SimpleRouteHandler = (
  request: Request,
  env: Env,
) => Promise<Response | null>;

export interface WorkerFetchDependencies {
  handleCors: (request: Request, env: Env) => Response | null;
  corsHeaders: (request: Request, env: Env) => Record<string, string>;
  enforceOriginGuard: (request: Request, env: Env) => Response | null;
  verifyToken: (request: Request, env: Env) => Response | null;
  jsonResponse: (data: unknown, status?: number) => Response;
  errorResponse: (message: string, status?: number) => Response;
  internalErrorResponse: (
    error: unknown,
    request: Request,
    options: { context: string; clientMessage?: string },
  ) => Response;
  rateLimit: (
    request: Request,
    env: Env,
    options: RateLimitOptions,
  ) => Promise<Response | null>;
  logger?: StructuredLogSink;
  now?: () => number;
  handleTeacherRoutes: RouteHandler;
  handleLogoutRoute: SimpleRouteHandler;
  handleQuizDraftRoutes: RouteHandler;
  handleQuizRoutes: RouteHandler;
  handleResultRoutes: RouteHandler;
  handleClassroomRoutes: RouteHandler;
  handleGamificationRoutes: RouteHandler;
  handleAnnouncementRoutes: RouteHandler;
  handleAiTutorRoutes: RouteHandler;
  handleAiProxy: RouteHandler;
  handlePracticeRoutes: RouteHandler;
  handleGiftShopRoutes: RouteHandler;
  handleGameLoopRoutes: RouteHandler;
  handleHelpRagRoutes: RouteHandler;
  handleSystemSettingsRoutes: RouteHandler;
  handleResultReportRoutes: RouteHandler;
  handlePhieuRoutes: RouteHandler;
  handleHomeworkRoutes: RouteHandler;
  handleAnalyticsRoutes: RouteHandler;
  handleTestBankRoutes: RouteHandler;
  handleTeacherAiQuotaRoutes: RouteHandler;
  handleLiveExamRoutes: RouteHandler;
  handleNotificationRoutes: RouteHandler;
  handleCertificateRoutes: RouteHandler;
  handleAdminCertificateRoutes: RouteHandler;
  handleMathObservabilityRoutes: RouteHandler;
  handleClientErrorRoute: RouteHandler;
  handlePhieuSubdomain: SimpleRouteHandler;
  handlePublicPhieuApi: (
    db: Env['DB'],
    path: string,
    method: string,
  ) => Promise<Response | null>;
  handleParentPortalRoutes: (
    request: Request,
    env: Env,
    path: string,
    method: string,
  ) => Promise<Response>;
}

export function createWorkerFetch(dependencies: WorkerFetchDependencies) {
  const {
    handleCors,
    corsHeaders,
    enforceOriginGuard,
    verifyToken,
    jsonResponse,
    errorResponse,
    internalErrorResponse,
    rateLimit,
    logger = console,
    now = Date.now,
    handleTeacherRoutes,
    handleLogoutRoute,
    handleQuizDraftRoutes,
    handleQuizRoutes,
    handleResultRoutes,
    handleClassroomRoutes,
    handleGamificationRoutes,
    handleAnnouncementRoutes,
    handleAiTutorRoutes,
    handleAiProxy,
    handlePracticeRoutes,
    handleGiftShopRoutes,
    handleGameLoopRoutes,
    handleHelpRagRoutes,
    handleSystemSettingsRoutes,
    handleResultReportRoutes,
    handlePhieuRoutes,
    handleHomeworkRoutes,
    handleAnalyticsRoutes,
    handleTestBankRoutes,
    handleTeacherAiQuotaRoutes,
    handleLiveExamRoutes,
    handleNotificationRoutes,
    handleCertificateRoutes,
    handleAdminCertificateRoutes,
    handleMathObservabilityRoutes,
    handleClientErrorRoute,
    handlePhieuSubdomain,
    handlePublicPhieuApi,
    handleParentPortalRoutes,
  } = dependencies;

  const addCors = (response: Response, request: Request, env: Env): Response => {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(request, env))) {
      headers.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };

  return async function fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const requestId = getRequestId(request);
    const startedAt = now();

    const dispatch = async (): Promise<Response> => {
    const corsResponse = handleCors(request, env);
    if (corsResponse) return corsResponse;

    if (path === '/api/health') {
      return addCors(
        jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }),
        request,
        env,
      );
    }

    const originError = enforceOriginGuard(request, env);
    if (originError) return addCors(originError, request, env);

    if (path === '/api/client-errors') {
      const rateLimitResponse = await rateLimit(request, env, {
        windowMs: 60 * 1000,
        maxRequests: 30,
        failureMode: 'closed',
      });
      if (rateLimitResponse) return addCors(rateLimitResponse, request, env);
      const clientErrorResponse = await handleClientErrorRoute(request, env, path, method);
      if (clientErrorResponse) return addCors(clientErrorResponse, request, env);
    }

    const isUnsafeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isLoginAttempt = method === 'POST'
      && (path === '/api/login' || path === '/api/student-login');
    if (isLoginAttempt) {
      const rateLimitResponse = await rateLimit(request, env, {
        windowMs: 60 * 1000,
        maxRequests: 20,
        failureMode: 'closed',
      });
      if (rateLimitResponse) return addCors(rateLimitResponse, request, env);
    }

    const isParentLoginAttempt = method === 'POST'
      && (path === '/api/parent/activate' || path === '/api/parent/login');
    if (isParentLoginAttempt) {
      const rateLimitResponse = await rateLimit(request, env, {
        windowMs: 5 * 60 * 1000,
        maxRequests: 10,
        failureMode: 'closed',
      });
      if (rateLimitResponse) return addCors(rateLimitResponse, request, env);
    }

    const isAdminMutation = isUnsafeMethod && (
      path.startsWith('/api/admin/')
      || path === '/api/teachers'
      || path.startsWith('/api/teachers/')
      || path === '/api/system-settings'
      || path === '/api/announcements'
      || path.startsWith('/api/classes')
      || path.startsWith('/api/gift-shop/catalog')
    );
    if (isAdminMutation) {
      const rateLimitResponse = await rateLimit(request, env, {
        windowMs: 60 * 1000,
        maxRequests: 30,
        failureMode: 'closed',
      });
      if (rateLimitResponse) return addCors(rateLimitResponse, request, env);
    }

    if (
      path.startsWith('/api/math/telemetry')
      || path.startsWith('/api/admin/math-audit')
      || path.startsWith('/api/admin/math-telemetry')
    ) {
      if (path === '/api/math/telemetry' && method === 'POST') {
        const rateLimitResponse = await rateLimit(request, env, {
          windowMs: 60 * 1000,
          maxRequests: 30,
        });
        if (rateLimitResponse) return addCors(rateLimitResponse, request, env);
      }

      const mathResponse = await handleMathObservabilityRoutes(request, env, path, method);
      if (mathResponse) return addCors(mathResponse, request, env);
    }

    const phieuSubdomainResponse = await handlePhieuSubdomain(request, env);
    if (phieuSubdomainResponse) return addCors(phieuSubdomainResponse, request, env);

    if (path.startsWith('/api/phieu/public')) {
      const rateLimitResponse = await rateLimit(request, env, {
        windowMs: 60 * 1000,
        maxRequests: 30,
      });
      if (rateLimitResponse) return addCors(rateLimitResponse, request, env);
    }

    const publicPhieuResponse = await handlePublicPhieuApi(env.DB, path, method);
    if (publicPhieuResponse) return addCors(publicPhieuResponse, request, env);

    const isParentRoute = path.startsWith('/api/parent/')
      || path.startsWith('/api/parent-links')
      || path.startsWith('/api/parent-announcements')
      || path.startsWith('/api/parent-delivery');
    if (isParentRoute) {
      const parentResponse = await handleParentPortalRoutes(request, env, path, method);
      return addCors(parentResponse, request, env);
    }

    const authError = verifyToken(request, env);
    if (authError) return addCors(authError, request, env);

    try {
      let response: Response | null = null;

      if (
        path.startsWith('/api/teachers')
        || path.startsWith('/api/admin/teachers')
        || path.startsWith('/api/account')
        || path === '/api/login'
      ) {
        response = await handleTeacherRoutes(request, env, path, method);
      } else if (path === '/api/logout' && method === 'POST') {
        response = await handleLogoutRoute(request, env);
      } else if (path.startsWith('/api/quiz-drafts/')) {
        response = await handleQuizDraftRoutes(request, env, path, method);
      } else if (path.startsWith('/api/quizzes') || path.startsWith('/api/questions')) {
        response = await handleQuizRoutes(request, env, path, method);
      } else if (path.startsWith('/api/results') || path === '/api/validate') {
        response = await handleResultRoutes(request, env, path, method);
      } else if (
        path.startsWith('/api/classes')
        || path.startsWith('/api/students')
        || path.startsWith('/api/assignments')
        || path === '/api/student-login'
        || path === '/api/student-profile'
      ) {
        response = await handleClassroomRoutes(request, env, path, method);
      } else if (
        path.startsWith('/api/pets')
        || path.startsWith('/api/game-state')
        || path.startsWith('/api/shop')
        || path.startsWith('/api/leaderboard')
      ) {
        response = await handleGamificationRoutes(request, env, path, method);
      } else if (
        path.startsWith('/api/announcements')
        || path.startsWith('/api/admin/announcements')
      ) {
        response = await handleAnnouncementRoutes(request, env, path, method);
      } else if (path.startsWith('/api/ai-tutor')) {
        const rateLimitResponse = await rateLimit(request, env, {
          windowMs: 60 * 1000,
          maxRequests: 10,
          failureMode: 'closed',
        });
        if (rateLimitResponse) return addCors(rateLimitResponse, request, env);
        response = await handleAiTutorRoutes(request, env, path, method);
      } else if (path.startsWith('/api/ai/')) {
        response = await handleAiProxy(request, env, path, method);
      } else if (path.startsWith('/api/practice')) {
        response = await handlePracticeRoutes(request, env, path, method);
      } else if (path.startsWith('/api/gift-shop')) {
        response = await handleGiftShopRoutes(request, env, path, method);
      } else if (path.startsWith('/api/game-loop')) {
        response = await handleGameLoopRoutes(request, env, path, method);
      } else if (path.startsWith('/api/help')) {
        response = await handleHelpRagRoutes(request, env, path, method);
      } else if (path.startsWith('/api/system-settings')) {
        response = await handleSystemSettingsRoutes(request, env, path, method);
      } else if (path.startsWith('/api/result-reports')) {
        response = await handleResultReportRoutes(request, env, path, method);
      } else if (path.startsWith('/api/phieu')) {
        response = await handlePhieuRoutes(request, env, path, method);
      } else if (path.startsWith('/api/homework')) {
        const rateLimitResponse = await rateLimit(request, env, {
          windowMs: 60 * 1000,
          maxRequests: 60,
        });
        if (rateLimitResponse) return addCors(rateLimitResponse, request, env);
        response = await handleHomeworkRoutes(request, env, path, method);
      } else if (path.startsWith('/api/analytics')) {
        response = await handleAnalyticsRoutes(request, env, path, method);
      } else if (path.startsWith('/api/test-bank')) {
        response = await handleTestBankRoutes(request, env, path, method);
      } else if (path.startsWith('/api/teacher-ai-quota')) {
        response = await handleTeacherAiQuotaRoutes(request, env, path, method);
      } else if (path.startsWith('/api/live-exam')) {
        response = await handleLiveExamRoutes(request, env, path, method);
      } else if (path.startsWith('/api/notifications')) {
        response = await handleNotificationRoutes(request, env, path, method);
      } else if (
        path.startsWith('/api/certificate-batches')
        || path.startsWith('/api/certificates')
      ) {
        response = await handleCertificateRoutes(request, env, path, method);
      } else if (path.startsWith('/api/admin/certificate-templates')) {
        response = await handleAdminCertificateRoutes(request, env, path, method);
      }

      if (response) return addCors(response, request, env);
      return addCors(errorResponse('Not found: ' + path, 404), request, env);
    } catch (error: unknown) {
      return addCors(
        internalErrorResponse(error, request, { context: `${method} ${path}` }),
        request,
        env,
      );
    }
    };

    const response = await dispatch();
    const correlatedResponse = withRequestId(response, requestId);
    logStructured('info', {
      event: 'worker_request_completed',
      requestId,
      route: path,
      method,
      status: response.status,
      durationMs: now() - startedAt,
    }, logger);
    return correlatedResponse;
  };
}
