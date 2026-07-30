// JWT utilities for authentication.
// Uses jose for Cloudflare Workers compatibility.

import { SignJWT, jwtVerify } from 'jose';

export const JWT_ISSUER = 'tohieuquiz-api';
export const JWT_AUDIENCE = 'tohieuquiz-web';

export interface JWTPayload {
    id?: string;
    username: string;
    role: 'student' | 'teacher' | 'admin';
    fullName?: string;
    classId?: string;
    school_id?: string;
    tokenVersion?: number;
    sessionId?: string;
    purpose?: 'session' | 'password_change';
    iss?: string;
    aud?: string | string[];
    iat?: number;
    exp?: number;
}

/** Sign a JWT token with registered claims and user information. */
export async function signJWT(
    payload: Omit<JWTPayload, 'iat' | 'exp'>,
    secret: string,
    expiresIn: string = '7d',
): Promise<string> {
    const secretKey = new TextEncoder().encode(secret);
    const normalizedPayload = {
        ...payload,
        purpose: payload.purpose ?? 'session',
    };
    if (!isValidAuthPayload({
        ...normalizedPayload,
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
    })) {
        throw new Error('Invalid JWT payload');
    }

    return new SignJWT(normalizedPayload as Record<string, unknown>)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secretKey);
}

function hasExpectedAudience(audience: unknown): boolean {
    if (typeof audience === 'string') return audience === JWT_AUDIENCE;
    return Array.isArray(audience)
        && audience.length > 0
        && audience.every((item) => typeof item === 'string')
        && audience.includes(JWT_AUDIENCE);
}

export function hasRegisteredJWTClaims(payload: Pick<JWTPayload, 'iss' | 'aud'>): boolean {
    return payload.iss === JWT_ISSUER && hasExpectedAudience(payload.aud);
}

function isOptionalString(value: unknown, maxLength = 256): boolean {
    return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

function isValidAuthPayload(
    payload: Record<string, unknown>,
): payload is JWTPayload & Record<string, unknown> {
    if (typeof payload.username !== 'string' || !payload.username.trim() || payload.username.length > 128) return false;
    if (!['student', 'teacher', 'admin'].includes(String(payload.role))) return false;
    if (!isOptionalString(payload.id, 128)
        || !isOptionalString(payload.fullName, 256)
        || !isOptionalString(payload.classId, 128)
        || !isOptionalString(payload.school_id, 128)
        || !isOptionalString(payload.sessionId, 128)) return false;
    if (payload.tokenVersion !== undefined
        && (!Number.isInteger(payload.tokenVersion) || Number(payload.tokenVersion) < 0)) return false;
    if (!hasRegisteredJWTClaims(payload as Pick<JWTPayload, 'iss' | 'aud'>)) return false;
    return payload.purpose === 'session' || payload.purpose === 'password_change';
}

/** Verify and decode a JWT token using the current registered-claims contract. */
export async function verifyJWT(
    token: string,
    secret: string,
): Promise<JWTPayload | null> {
    try {
        const secretKey = new TextEncoder().encode(secret);
        const { payload } = await jwtVerify(token, secretKey, {
            algorithms: ['HS256'],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
        const candidate = payload as Record<string, unknown>;
        if (!isValidAuthPayload(candidate)) return null;

        return {
            ...(candidate as unknown as JWTPayload),
            purpose: candidate.purpose === 'password_change' ? 'password_change' : 'session',
        };
    } catch (error) {
        const reason = error instanceof Error ? error.name : 'UnknownError';
        console.error('[JWT] Verification failed', { reason });
        return null;
    }
}

/** Extract JWT from the host-only auth cookie. */
export function extractJWTFromCookie(request: Request): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;

    for (const part of cookieHeader.split(';')) {
        const cookie = part.trim();
        if (!cookie.startsWith('auth_token=')) continue;
        const token = cookie.slice('auth_token='.length).trim();
        return token || null;
    }
    return null;
}

/** Extract JWT only from the host-only auth cookie. */
export function extractJWTFromRequest(request: Request): string | null {
    return extractJWTFromCookie(request);
}

/** Create Set-Cookie header for JWT. */
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

/** Create Set-Cookie header that clears JWT. */
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
