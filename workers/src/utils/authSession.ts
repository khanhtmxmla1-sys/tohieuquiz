import type { Env } from '../types';
import { clearJWTCookie, createJWTCookie } from './jwt';

type AuthTransportEnv = Pick<Env, 'AUTH_TOKEN_TRANSPORT_MODE'>;

export function getAuthTokenTransportMode(env: AuthTransportEnv): 'compat' | 'cookie' {
    return env.AUTH_TOKEN_TRANSPORT_MODE === 'cookie' ? 'cookie' : 'compat';
}

export function buildAuthSessionData<T extends Record<string, unknown>>(
    env: AuthTransportEnv,
    data: T,
    token: string,
): T & { token?: string } {
    if (getAuthTokenTransportMode(env) === 'cookie') return { ...data };
    return { ...data, token };
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
