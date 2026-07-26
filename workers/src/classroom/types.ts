import type { Env } from '../types';
import type { JWTPayload } from '../utils/jwt';

export interface ClassroomRouteContext {
    request: Request;
    env: Env;
    path: string;
    method: string;
    db: D1Database;
    url: URL;
    nowIso: string;
    user: JWTPayload;
}

export type ClassroomRouteHandler = (
    context: ClassroomRouteContext
) => Promise<Response | null>;
