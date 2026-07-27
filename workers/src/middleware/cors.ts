// Environment-aware CORS policy for Cloudflare Workers.

import { Env } from '../types';
import { errorResponse } from '../utils/response';

const DEVELOPMENT_ORIGINS = new Set([
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
]);

function normalizeOrigin(origin: string): string | null {
    try {
        const parsed = new URL(origin);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
        if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') return null;
        return parsed.origin;
    } catch {
        return null;
    }
}

function configuredProductionOrigins(env: Env): Set<string> {
    return new Set(
        String(env.ALLOWED_ORIGINS || '')
            .split(',')
            .map((value) => normalizeOrigin(value.trim()))
            .filter((value): value is string => Boolean(value)),
    );
}

function isLocalHostname(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function isDevelopmentRequest(request: Request, env: Env): boolean {
    if (env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'test') return true;
    return isLocalHostname(new URL(request.url).hostname);
}

export function isOriginAllowed(request: Request, env: Env, suppliedOrigin?: string): boolean {
    const rawOrigin = suppliedOrigin ?? request.headers.get('Origin') ?? '';
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) return false;

    if (origin === new URL(request.url).origin) return true;
    if (configuredProductionOrigins(env).has(origin)) return true;
    return isDevelopmentRequest(request, env) && DEVELOPMENT_ORIGINS.has(origin);
}

export function corsHeaders(request: Request, env: Env = {} as Env): Record<string, string> {
    const origin = request.headers.get('Origin') || '';
    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Expose-Headers': 'x-request-id',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };

    if (origin && isOriginAllowed(request, env, origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}

export function handleCors(request: Request, env: Env = {} as Env): Response | null {
    if (request.method !== 'OPTIONS') return null;

    const origin = request.headers.get('Origin');
    if (origin && !isOriginAllowed(request, env, origin)) {
        const response = errorResponse('Forbidden: Request origin is not allowed.', 403);
        const headers = new Headers(response.headers);
        headers.set('Vary', 'Origin');
        return new Response(response.body, { status: response.status, headers });
    }

    return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
    });
}
