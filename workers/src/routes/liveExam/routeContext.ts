import type { Env } from '../../types';

export interface LiveExamRouteContext {
  request: Request;
  env: Env;
  db: D1Database;
  path: string;
  method: string;
}

export type LiveExamRouteHandler = (
  context: LiveExamRouteContext,
) => Promise<Response | null>;

export function createLiveExamRouteContext(
  request: Request,
  env: Env,
  path: string,
  method: string,
): LiveExamRouteContext {
  return { request, env, db: env.DB, path, method };
}
