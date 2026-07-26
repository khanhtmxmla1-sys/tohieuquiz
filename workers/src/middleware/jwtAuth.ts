// JWT Authentication Middleware
// Validates JWT tokens and attaches user context to requests

import { Env } from '../types';
import { errorResponse } from '../utils/response';
import { extractJWTFromRequest, verifyJWT, JWTPayload } from '../utils/jwt';

// Extend Request type to include user context
export interface AuthenticatedRequest extends Request {
    user?: JWTPayload;
}

/**
 * Verify JWT token and attach user to request
 * Returns error response if JWT is invalid or missing
 * Returns null if JWT is valid (allows request to proceed)
 */
export async function verifyJWTMiddleware(
    request: Request,
    env: Env
): Promise<{ user: JWTPayload } | Response> {
    const token = extractJWTFromRequest(request);

    if (!token) {
        return errorResponse('Unauthorized: Missing authentication token', 401);
    }

    if (!env.JWT_SECRET) {
        console.error('[JWT Middleware] JWT_SECRET not configured');
        return errorResponse('Authentication service unavailable', 503);
    }

    const payload = await verifyJWT(token, env.JWT_SECRET, {
        allowLegacy: (env.AUTH_MIGRATION_MODE || 'compat') !== 'enforce',
    });

    if (!payload) {
        return errorResponse('Unauthorized: Invalid or expired token', 401);
    }

    if (payload.purpose === 'password_change' && new URL(request.url).pathname !== '/api/account/change-password') {
        return errorResponse('Password change required', 403);
    }

    if (payload.role === 'teacher' || payload.role === 'admin') {
        const enforce = (env.AUTH_MIGRATION_MODE || 'compat') === 'enforce';
        const path = new URL(request.url).pathname;

        const account = await env.DB.prepare(`
            SELECT status, token_version, must_change_password
            FROM teachers
            WHERE username = ?
            LIMIT 1
        `).bind(payload.username).first<{ status: string; token_version: number; must_change_password: number }>();

        if (!account || account.status === 'DISABLED') {
            return errorResponse('Unauthorized: Account is disabled', 401);
        }

        if (Number(account.must_change_password) === 1 && path !== '/api/account/change-password') {
            return errorResponse('Password change required', 403);
        }

        if ((enforce && payload.tokenVersion === undefined)
            || (payload.tokenVersion !== undefined && payload.tokenVersion !== Number(account.token_version))) {
            return errorResponse('Unauthorized: Session has been revoked', 401);
        }
    }

    // Return user context to be attached to request
    return { user: payload };
}

/**
 * Check if user has admin role
 */
export function requireAdmin(user: JWTPayload): boolean {
    return user.role === 'admin';
}

/**
 * Check if user has teacher or admin role
 */
export function requireTeacher(user: JWTPayload): boolean {
    return user.role === 'admin' || user.role === 'teacher';
}

/**
 * Check if user owns the resource or is admin
 */
export function requireOwnership(user: JWTPayload, resourceOwner: string): boolean {
    return user.role === 'admin' || user.username === resourceOwner;
}

/**
 * Check if user is a student
 */
export function isStudent(user: JWTPayload): boolean {
    return user.role === 'student';
}
