// Logout Route Handler
// Clears JWT authentication cookie

import { Env } from '../types';
import { jsonResponse } from '../utils/response';
import { withClearedAuthCookie } from '../utils/authSession';
import { extractJWTFromRequest, verifyJWT } from '../utils/jwt';
import { revokeAuthSession } from '../services/authSessionService';

export async function handleLogoutRoute(request: Request, env: Env): Promise<Response> {
    const token = extractJWTFromRequest(request);
    if (token && env.JWT_SECRET) {
        const payload = await verifyJWT(token, env.JWT_SECRET);
        if (payload?.sessionId) {
            await revokeAuthSession(env.DB, payload, payload.sessionId, {
                actorUsername: payload.username,
                reason: 'logout',
                requestId: request.headers.get('x-request-id') || request.headers.get('cf-ray') || crypto.randomUUID(),
            });
        }
    }
    const response = jsonResponse({
        status: 'success',
        message: 'Logged out successfully',
    });

    return withClearedAuthCookie(response);
}
