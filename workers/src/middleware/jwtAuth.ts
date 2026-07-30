// JWT Authentication Middleware.
// Validates JWT tokens and attaches user context to requests.

import { Env } from '../types';
import { assertActiveAuthSession } from '../services/authSessionService';
import { errorResponse } from '../utils/response';
import {
    extractJWTFromRequest,
    verifyJWT,
    type JWTPayload,
} from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
    user?: JWTPayload;
}

/** Verify JWT token and return user context or an error response. */
export async function verifyJWTMiddleware(
    request: Request,
    env: Env,
): Promise<{ user: JWTPayload } | Response> {
    const token = extractJWTFromRequest(request);

    if (!token) {
        return errorResponse('Unauthorized: Missing authentication token', 401);
    }

    if (!env.JWT_SECRET) {
        console.error('[JWT Middleware] JWT_SECRET not configured');
        return errorResponse('Authentication service unavailable', 503);
    }

    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload) {
        return errorResponse('Unauthorized: Invalid or expired token', 401);
    }

    if (payload.tokenVersion === undefined) {
        return errorResponse('Unauthorized: Session has been revoked', 401);
    }

    if (payload.sessionId) {
        const active = await assertActiveAuthSession(env.DB, payload);
        if (!active) return errorResponse('Unauthorized: Session has been revoked', 401);
    } else if (env.AUTH_SESSION_MODE === 'enforce') {
        return errorResponse('Unauthorized: Session has been revoked', 401);
    }

    const path = new URL(request.url).pathname;
    if (payload.purpose === 'password_change' && path !== '/api/account/change-password') {
        return errorResponse('Password change required', 403);
    }

    if (payload.role === 'teacher' || payload.role === 'admin') {
        const account = await env.DB.prepare(`
            SELECT status, token_version, must_change_password
            FROM teachers
            WHERE username = ?
            LIMIT 1
        `).bind(payload.username).first<{
            status: string;
            token_version: number;
            must_change_password: number;
        }>();

        if (!account || account.status === 'DISABLED') {
            return errorResponse('Unauthorized: Account is disabled', 401);
        }

        if (Number(account.must_change_password) === 1 && path !== '/api/account/change-password') {
            return errorResponse('Password change required', 403);
        }

        if (payload.tokenVersion !== Number(account.token_version)) {
            return errorResponse('Unauthorized: Session has been revoked', 401);
        }
    }

    return { user: payload };
}

export function requireAdmin(user: JWTPayload): boolean {
    return user.role === 'admin';
}

export function requireTeacher(user: JWTPayload): boolean {
    return user.role === 'admin' || user.role === 'teacher';
}

export function requireOwnership(user: JWTPayload, resourceOwner: string): boolean {
    return user.role === 'admin' || user.username === resourceOwner;
}

export function isStudent(user: JWTPayload): boolean {
    return user.role === 'student';
}
