import { createParentLinkRepository } from '../../parentPortal/repository';
import { verifyParentSession } from '../../parentPortal/session';
import type { ParentSessionPayload } from '../../parentPortal/types';
import type { Env } from '../../types';
import { jsonResponse } from '../../utils/response';

export const parentRouteError = (code: string, message: string, status: number): Response => (
  jsonResponse({ error: { code, message } }, status)
);

export const parentRouteSuccess = <T>(data: T, status = 200): Response => (
  jsonResponse({ data }, status)
);

export async function authenticateParentRoute(
  request: Request,
  env: Env,
): Promise<ParentSessionPayload | Response> {
  if (!env.JWT_SECRET) {
    return parentRouteError(
      'PARENT_AUTH_UNAVAILABLE',
      'Dịch vụ đăng nhập tạm thời không khả dụng.',
      503,
    );
  }
  const repository = createParentLinkRepository(env.DB);
  const session = await verifyParentSession(request, env.JWT_SECRET, repository);
  if (!session) {
    return parentRouteError(
      'PARENT_SESSION_INVALID',
      'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      401,
    );
  }
  return session;
}
