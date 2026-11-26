import { Env } from '../../types';
import { jsonResponse } from '../../utils/response';
import { verifyJWTMiddleware } from '../../middleware/jwtAuth';
import { extractJWTFromRequest, JWTPayload } from '../../utils/jwt';

export const privateJsonResponse = <T>(data: T, status = 200): Response => {
    const response = jsonResponse(data, status);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store');
    return new Response(response.body, { status: response.status, headers });
};

export const privateErrorResponse = (message: string, status = 400): Response =>
    privateJsonResponse({ status: 'error', message }, status);

export const privateizeResponse = (response: Response): Response => {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store');
    return new Response(response.body, { status: response.status, headers });
};

export const optionalAuthUser = async (
    request: Request,
    env: Env,
): Promise<{ user: JWTPayload | null; failure: Response | null }> => {
    const authResult = await verifyJWTMiddleware(request, env);
    if (!(authResult instanceof Response)) return { user: authResult.user, failure: null };
    if (extractJWTFromRequest(request)) return { user: null, failure: privateizeResponse(authResult) };
    return { user: null, failure: null };
};
