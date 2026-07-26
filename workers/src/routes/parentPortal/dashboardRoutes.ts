import type { ParentSessionPayload } from '../../parentPortal/types';
import {
  createParentDashboardService,
  resolveIctWeekWindow,
  type ParentDashboardService,
} from '../../parentPortal/dashboardService';
import type { Env } from '../../types';
import {
  authenticateParentRoute,
  parentRouteError,
  parentRouteSuccess,
} from './sessionAuth';

export interface ParentDashboardRouteRuntime {
  authenticate(request: Request, env: Env): Promise<ParentSessionPayload | Response>;
  service: ParentDashboardService;
  now(): Date;
}

const makeRuntime = (env: Env): ParentDashboardRouteRuntime => ({
  authenticate: authenticateParentRoute,
  service: createParentDashboardService(env.DB),
  now: () => new Date(),
});

export async function handleParentDashboardRoutes(
  request: Request,
  env: Env,
  path: string,
  method: string,
  injectedRuntime?: ParentDashboardRouteRuntime,
): Promise<Response | null> {
  if (path !== '/api/parent/dashboard') return null;
  if (method !== 'GET') return parentRouteError('PARENT_METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ.', 405);
  const runtime = injectedRuntime || makeRuntime(env);
  const session = await runtime.authenticate(request, env);
  if (session instanceof Response) return session;
  try {
    const requested = new URL(request.url).searchParams.get('weekStart') || undefined;
    const window = resolveIctWeekWindow(requested, runtime.now());
    return parentRouteSuccess(await runtime.service.loadDashboard(session.studentId, window, runtime.now()));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid dashboard request';
    if (/weekStart|Monday/i.test(message)) {
      return parentRouteError('PARENT_WEEK_INVALID', message, 400);
    }
    throw error;
  }
}
