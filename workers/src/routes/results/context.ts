import type { Env } from '../../types';
import type { JWTPayload } from '../../utils/jwt';

export interface ResultRouteContext {
    request: Request;
    env: Env;
    db: D1Database;
    user: JWTPayload;
    path: string;
    method: string;
}

export type ResultRouteHandler = (context: ResultRouteContext) => Promise<Response | null>;
