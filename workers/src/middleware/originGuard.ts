import { Env } from '../types';
import { errorResponse } from '../utils/response';
import { isOriginAllowed } from './cors';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Browser mutations with an Origin header must come from an allowlisted origin.
 * Requests without Origin remain available to trusted server-to-server clients;
 * browser credentialed fetches and form submissions send Origin on unsafe methods.
 */
export function enforceOriginGuard(request: Request, env: Env): Response | null {
    if (!UNSAFE_METHODS.has(request.method.toUpperCase())) return null;

    const origin = request.headers.get('Origin');
    if (!origin) return null;
    if (isOriginAllowed(request, env, origin)) return null;

    return errorResponse('Forbidden: Request origin is not allowed.', 403);
}
