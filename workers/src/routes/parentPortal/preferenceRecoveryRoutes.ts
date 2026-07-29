import type { ParentContactPreferencesInput } from '../../../../shared/parent-portal.contract';
import { createParentAccountService, ParentAccountError, type ParentAccountService } from '../../parentPortal/accountService';
import { createParentEmailProvider } from '../../parentPortal/emailProvider';
import { clearParentCookie } from '../../parentPortal/session';
import type { ParentSessionPayload } from '../../parentPortal/types';
import type { Env } from '../../types';
import { authenticateParentRoute, parentRouteError, parentRouteSuccess } from './sessionAuth';

export interface ParentPreferenceRecoveryRouteRuntime {
  authenticate(request: Request, env: Env): Promise<ParentSessionPayload | Response>;
  account: ParentAccountService;
  now(): Date;
}

const makeRuntime = (env: Env): ParentPreferenceRecoveryRouteRuntime => ({
  authenticate: authenticateParentRoute,
  account: createParentAccountService(
    env.DB,
    createParentEmailProvider(env),
    String(env.PARENT_EMAIL_PUBLIC_BASE_URL || ''),
  ),
  now: () => new Date(),
});

const readJson = async (request: Request): Promise<Record<string, unknown>> => {
  try {
    const value = await request.json();
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const requestIdOf = (request: Request): string => (
  request.headers.get('x-request-id')?.trim().slice(0, 128) || crypto.randomUUID()
);

const noStore = (response: Response): Response => {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Pragma', 'no-cache');
  return response;
};

const knownPaths = new Set([
  '/api/parent/preferences',
  '/api/parent/preferences/email/request-verification',
  '/api/parent/preferences/email/verify',
  '/api/parent/recovery/request',
  '/api/parent/recovery/confirm',
]);

const handleError = (error: unknown): Response => {
  if (error instanceof ParentAccountError) {
    return noStore(parentRouteError(error.code, error.message, error.status));
  }
  if (error instanceof Error && error.message.startsWith('PARENT_EMAIL_')) {
    return noStore(parentRouteError(
      'PARENT_EMAIL_SEND_FAILED',
      'Không thể gửi email lúc này. Vui lòng thử lại sau.',
      502,
    ));
  }
  throw error;
};

export async function handleParentPreferenceRecoveryRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
  injectedRuntime?: ParentPreferenceRecoveryRouteRuntime,
): Promise<Response | null> {
  if (!knownPaths.has(path)) return null;
  const runtime = injectedRuntime || makeRuntime(env);
  const requestId = requestIdOf(request);

  try {
    if (path === '/api/parent/preferences') {
      const session = await runtime.authenticate(request, env);
      if (session instanceof Response) return noStore(session);
      if (method === 'GET') {
        return noStore(parentRouteSuccess(await runtime.account.getPreferences(session.linkId)));
      }
      if (method === 'PUT') {
        const body = await readJson(request);
        return noStore(parentRouteSuccess(await runtime.account.updatePreferences(
          session.linkId,
          body as unknown as ParentContactPreferencesInput,
          runtime.now(),
          requestId,
        )));
      }
      return noStore(parentRouteError('PARENT_METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.', 405));
    }

    if (path === '/api/parent/preferences/email/request-verification') {
      if (method !== 'POST') return noStore(parentRouteError('PARENT_METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.', 405));
      const session = await runtime.authenticate(request, env);
      if (session instanceof Response) return noStore(session);
      return noStore(parentRouteSuccess(await runtime.account.requestEmailVerification(
        session.linkId,
        runtime.now(),
        requestId,
      ), 202));
    }

    const body = await readJson(request);
    if (path === '/api/parent/preferences/email/verify' && method === 'POST') {
      return noStore(parentRouteSuccess(await runtime.account.verifyEmail(
        typeof body.token === 'string' ? body.token : '',
        runtime.now(),
        requestId,
      )));
    }
    if (path === '/api/parent/recovery/request' && method === 'POST') {
      return noStore(parentRouteSuccess(await runtime.account.requestRecovery(
        typeof body.accessCode === 'string' ? body.accessCode : '',
        typeof body.email === 'string' ? body.email : '',
        runtime.now(),
        requestId,
      ), 202));
    }
    if (path === '/api/parent/recovery/confirm' && method === 'POST') {
      const response = noStore(parentRouteSuccess(await runtime.account.confirmRecovery(
        typeof body.token === 'string' ? body.token : '',
        typeof body.pin === 'string' ? body.pin : '',
        runtime.now(),
        requestId,
      )));
      response.headers.set('Set-Cookie', clearParentCookie());
      return response;
    }
    return noStore(parentRouteError('PARENT_METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.', 405));
  } catch (error) {
    return handleError(error);
  }
}
