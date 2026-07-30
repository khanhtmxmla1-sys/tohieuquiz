import { clearJWTCookie, createJWTCookie } from './jwt';

export function buildAuthSessionData<T extends Record<string, unknown>>(data: T): T {
    return { ...data };
}

function replaceResponseHeaders(response: Response, setCookie: string): Response {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.append('Set-Cookie', setCookie);
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

export function withAuthCookie(response: Response, token: string, maxAge?: number): Response {
    return replaceResponseHeaders(response, createJWTCookie(token, maxAge));
}

export function withClearedAuthCookie(response: Response): Response {
    return replaceResponseHeaders(response, clearJWTCookie());
}
