import {
  hashActivationToken,
  hashParentPin,
  validateParentPin,
  verifyParentPin,
} from '../../parentPortal/crypto';
import { createParentLinkRepository } from '../../parentPortal/repository';
import {
  clearParentCookie,
  createParentCookie,
  signParentSession,
  verifyParentSession,
} from '../../parentPortal/session';
import type {
  ParentActivationRecord,
  ParentLinkRepository,
} from '../../parentPortal/types';
import {
  parentPortalLogger,
  type ParentPortalEventLogger,
} from '../../parentPortal/observability';
import type { Env } from '../../types';
import { jsonResponse } from '../../utils/response';

export interface ParentAuthRouteRuntime {
  repository: ParentLinkRepository;
  now: () => Date;
  invalidDelay: () => Promise<void>;
  logger?: ParentPortalEventLogger;
}

const noStore = (response: Response): Response => {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Pragma', 'no-cache');
  return response;
};

const parentError = (code: string, message: string, status: number): Response => (
  noStore(jsonResponse({ error: { code, message } }, status))
);

const parentSuccess = <T>(data: T, status = 200): Response => noStore(jsonResponse({ data }, status));

const readJson = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const value = await request.json();
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const defaultInvalidDelay = async (): Promise<void> => {
  const delayMs = 75 + Math.floor(Math.random() * 51);
  await new Promise(resolve => setTimeout(resolve, delayMs));
};

const makeRuntime = (env: Env): ParentAuthRouteRuntime => ({
  repository: createParentLinkRepository(env.DB),
  now: () => new Date(),
  invalidDelay: defaultInvalidDelay,
  logger: parentPortalLogger,
});

const safePreviewStudent = (profile: {
  fullName: string;
  className: string;
  avatar: string;
}) => ({
  fullName: profile.fullName,
  className: profile.className,
  avatar: profile.avatar,
});

const validateActivation = async (
  token: string,
  runtime: ParentAuthRouteRuntime,
): Promise<ParentActivationRecord | Response> => {
  if (!token) {
    return parentError(
      'PARENT_ACTIVATION_TOKEN_REQUIRED',
      'Thiếu mã kích hoạt phụ huynh.',
      400,
    );
  }
  const activation = await runtime.repository.findActivationByHash(
    await hashActivationToken(token),
  );
  if (!activation) {
    return parentError(
      'PARENT_ACTIVATION_INVALID',
      'Mã kích hoạt không hợp lệ.',
      404,
    );
  }
  const nowMs = runtime.now().getTime();
  const expiresMs = Date.parse(activation.expiresAt);
  const unavailable = activation.consumedAt
    || activation.link.status !== 'PENDING'
    || !Number.isFinite(expiresMs)
    || expiresMs <= nowMs;
  if (unavailable) {
    return parentError(
      'PARENT_ACTIVATION_UNAVAILABLE',
      'Mã kích hoạt đã hết hạn hoặc không còn sử dụng được.',
      410,
    );
  }
  return activation;
};

const maskAccessCode = (accessCode: string): string => {
  const visible = accessCode.slice(-4);
  return `${'•'.repeat(Math.max(0, accessCode.length - visible.length))}${visible}`;
};

const authenticatedResponse = async (
  env: Env,
  runtime: ParentAuthRouteRuntime,
  link: {
    id: string;
    studentId: string;
    tokenVersion: number;
    accessCode: string;
  },
  event?: 'activated' | 'login_success',
): Promise<Response> => {
  if (!env.JWT_SECRET) {
    return parentError(
      'PARENT_AUTH_UNAVAILABLE',
      'Dịch vụ đăng nhập tạm thời không khả dụng.',
      503,
    );
  }
  const profile = await runtime.repository.loadProfile(link.studentId);
  if (!profile) {
    return parentError('PARENT_STUDENT_NOT_FOUND', 'Không tìm thấy học sinh.', 404);
  }
  const token = await signParentSession({
    linkId: link.id,
    studentId: link.studentId,
    tokenVersion: link.tokenVersion,
    purpose: 'parent_session',
  }, env.JWT_SECRET);
  const response = parentSuccess({ student: profile, accessCodeMasked: maskAccessCode(link.accessCode) });
  response.headers.set('Set-Cookie', createParentCookie(token));
  if (event) runtime.logger?.info(event, { linkId: link.id, studentId: link.studentId });
  return response;
};

const invalidLogin = async (runtime: ParentAuthRouteRuntime): Promise<Response> => {
  await runtime.invalidDelay();
  runtime.logger?.warn('login_failed', { reason: 'invalid_credentials' });
  return parentError(
    'PARENT_LOGIN_INVALID',
    'Thông tin đăng nhập không đúng.',
    401,
  );
};

export async function handleParentAuthRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
  injectedRuntime?: ParentAuthRouteRuntime,
): Promise<Response | null> {
  const knownPath = path === '/api/parent/activation'
    || path === '/api/parent/activate'
    || path === '/api/parent/login'
    || path === '/api/parent/session'
    || path === '/api/parent/logout';
  if (!knownPath) return null;

  const runtime = injectedRuntime || makeRuntime(env);

  if (path === '/api/parent/activation' && method === 'GET') {
    const token = new URL(request.url).searchParams.get('token')?.trim() || '';
    const activation = await validateActivation(token, runtime);
    if (activation instanceof Response) return activation;
    const profile = await runtime.repository.loadProfile(activation.link.studentId);
    if (!profile) {
      return parentError('PARENT_STUDENT_NOT_FOUND', 'Không tìm thấy học sinh.', 404);
    }
    return parentSuccess({
      student: safePreviewStudent(profile),
      expiresAt: activation.expiresAt,
    });
  }

  if (path === '/api/parent/activate' && method === 'POST') {
    const body = await readJson(request);
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const pin = typeof body?.pin === 'string' ? body.pin : '';
    if (!validateParentPin(pin)) {
      return parentError(
        'PARENT_PIN_INVALID',
        'PIN phải gồm đúng 6 chữ số.',
        400,
      );
    }
    const activation = await validateActivation(token, runtime);
    if (activation instanceof Response) return activation;
    const nowIso = runtime.now().toISOString();
    await runtime.repository.activateLink(
      activation.link.id,
      await hashParentPin(pin),
      activation.id,
      nowIso,
    );
    const link = await runtime.repository.findById(activation.link.id);
    if (!link || link.status !== 'ACTIVE') {
      return parentError(
        'PARENT_ACTIVATION_FAILED',
        'Không thể kích hoạt quyền phụ huynh.',
        409,
      );
    }
    return authenticatedResponse(env, runtime, link, 'activated');
  }

  if (path === '/api/parent/login' && method === 'POST') {
    const body = await readJson(request);
    const accessCode = typeof body?.accessCode === 'string'
      ? body.accessCode.trim().toUpperCase()
      : '';
    const pin = typeof body?.pin === 'string' ? body.pin : '';
    if (!accessCode || !validateParentPin(pin)) return invalidLogin(runtime);

    const link = await runtime.repository.findByAccessCode(accessCode);
    if (!link || link.status !== 'ACTIVE' || !link.pinHash) return invalidLogin(runtime);
    if (!(await verifyParentPin(pin, link.pinHash))) return invalidLogin(runtime);
    return authenticatedResponse(env, runtime, link, 'login_success');
  }

  if (path === '/api/parent/session' && method === 'GET') {
    if (!env.JWT_SECRET) {
      return parentError(
        'PARENT_AUTH_UNAVAILABLE',
        'Dịch vụ đăng nhập tạm thời không khả dụng.',
        503,
      );
    }
    const payload = await verifyParentSession(request, env.JWT_SECRET, runtime.repository);
    if (!payload) {
      return parentError(
        'PARENT_SESSION_INVALID',
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
        401,
      );
    }
    const link = await runtime.repository.findById(payload.linkId);
    if (!link) {
      return parentError('PARENT_SESSION_INVALID', 'Phiên đăng nhập không hợp lệ.', 401);
    }
    const lastAccessMs = link.lastAccessedAt ? Date.parse(link.lastAccessedAt) : 0;
    const now = runtime.now();
    if (!Number.isFinite(lastAccessMs) || now.getTime() - lastAccessMs >= 60 * 60 * 1000) {
      await runtime.repository.touchLastAccessed(link.id, now.toISOString());
    }
    const profile = await runtime.repository.loadProfile(payload.studentId);
    if (!profile) {
      return parentError('PARENT_STUDENT_NOT_FOUND', 'Không tìm thấy học sinh.', 404);
    }
    return parentSuccess({ student: profile, accessCodeMasked: maskAccessCode(link.accessCode) });
  }

  if (path === '/api/parent/logout' && method === 'POST') {
    return new Response(null, {
      status: 204,
      headers: {
        'Set-Cookie': clearParentCookie(),
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
  }

  return parentError('PARENT_METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.', 405);
}
