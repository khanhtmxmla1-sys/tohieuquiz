// JWT utilities for authentication
// Uses jose library for Cloudflare Workers compatibility

import { SignJWT, jwtVerify } from 'jose';

export const JWT_ISSUER = 'tohieuquiz-api';
export const JWT_AUDIENCE = 'tohieuquiz-web';

export interface VerifyJWTOptions {
    allowLegacy?: boolean;
}

export interface JWTPayload {
    id?: string;
    username: string;
    role: 'student' | 'teacher' | 'admin';
    fullName?: string;
    classId?: string;
    school_id?: string;
    tokenVersion?: number;
    purpose?: 'session' | 'password_change';
    iss?: string;
    aud?: string | string[];
    iat?: number;
    exp?: number;
}

/**
 * Sign a JWT token with user information
 * @param payload User information to encode
 * @param secret JWT secret from environment
 * @param expiresIn Expiration time (default: 7 days)
 */
export async function signJWT(
    payload: Omit<JWTPayload, 'iat' | 'exp'>,
    secret: string,
    expiresIn: string = '7d'
): Promise<string> {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);

    const normalizedPayload = {
        ...payload,
        purpose: payload.purpose ?? 'session',
    };
    if (!isValidAuthPayload(normalizedPayload, true)) {
        throw new Error('Invalid JWT payload');
    }

    const jwt = await new SignJWT(normalizedPayload as any)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secretKey);

    return jwt;
}

/**
 * Verify and decode a JWT token
 * @param token JWT token to verify
 * @param secret JWT secret from environment
 * @returns Decoded payload or null if invalid
 */
function hasExpectedAudience(audience: unknown): boolean {
    if (typeof audience === 'string') return audience === JWT_AUDIENCE;
    return Array.isArray(audience) && audience.length > 0
        && audience.every(item => typeof item === 'string')
        && audience.includes(JWT_AUDIENCE);
}

function isOptionalString(value: unknown, maxLength = 256): boolean {
    return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

function isValidAuthPayload(payload: Record<string, unknown>, allowLegacy: boolean): payload is JWTPayload & Record<string, unknown> {
    if (typeof payload.username !== 'string' || !payload.username.trim() || payload.username.length > 128) return false;
    if (!['student', 'teacher', 'admin'].includes(String(payload.role))) return false;
    if (!isOptionalString(payload.id, 128)
        || !isOptionalString(payload.fullName, 256)
        || !isOptionalString(payload.classId, 128)
        || !isOptionalString(payload.school_id, 128)) return false;
    if (payload.tokenVersion !== undefined
        && (!Number.isInteger(payload.tokenVersion) || Number(payload.tokenVersion) < 0)) return false;

    const hasRegisteredClaims = payload.iss !== undefined || payload.aud !== undefined;
    if (hasRegisteredClaims) {
        if (payload.iss !== JWT_ISSUER || !hasExpectedAudience(payload.aud)) return false;
        if (payload.purpose !== 'session' && payload.purpose !== 'password_change') return false;
        return true;
    }

    if (!allowLegacy) return false;
    return payload.purpose === undefined || payload.purpose === 'session' || payload.purpose === 'password_change';
}

export async function verifyJWT(
    token: string,
    secret: string,
    options: VerifyJWTOptions = {},
): Promise<JWTPayload | null> {
    try {
        const encoder = new TextEncoder();
        const secretKey = encoder.encode(secret);
        const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
        const candidate = payload as Record<string, unknown>;
        if (!isValidAuthPayload(candidate, options.allowLegacy ?? true)) return null;

        return {
            ...(candidate as unknown as JWTPayload),
            purpose: candidate.purpose === 'password_change' ? 'password_change' : 'session',
        };
    } catch (error) {
        console.error('[JWT] Verification failed:', error);
        return null;
    }
}

/**
 * Extract JWT from cookie header
 * @param request Request object
 * @returns JWT token or null
 */
export function extractJWTFromCookie(request: Request): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));

    if (!authCookie) return null;

    return authCookie.split('=')[1];
}

/**
 * Extract JWT from Authorization bearer header or cookie.
 * Bearer support is needed when browsers block third-party cookies.
 */
export function extractJWTFromRequest(request: Request): string | null {
    const authorization = request.headers.get('Authorization') || '';
    if (authorization.toLowerCase().startsWith('bearer ')) {
        return authorization.slice(7).trim() || null;
    }

    return extractJWTFromCookie(request);
}

/**
 * Create Set-Cookie header for JWT
 * @param token JWT token
 * @param maxAge Max age in seconds (default: 7 days)
 * @returns Set-Cookie header value
 */
export function createJWTCookie(token: string, maxAge: number = 7 * 24 * 60 * 60): string {
    return [
        `auth_token=${token}`,
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        `Max-Age=${maxAge}`,
        'Path=/',
    ].join('; ');
}

/**
 * Create Set-Cookie header to clear JWT
 * @returns Set-Cookie header value that clears the cookie
 */
export function clearJWTCookie(): string {
    return [
        'auth_token=',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        'Max-Age=0',
        'Path=/',
    ].join('; ');
}
