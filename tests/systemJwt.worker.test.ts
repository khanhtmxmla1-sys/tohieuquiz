// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectConsoleError, expectConsoleMessage } from './helpers/expectedConsole';
import { SignJWT } from 'jose';
import {
    JWT_AUDIENCE,
    JWT_ISSUER,
    createJWTCookie,
    signJWT,
    verifyJWT,
} from '../workers/src/utils/jwt';
import { verifyJWTMiddleware } from '../workers/src/middleware/jwtAuth';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('JWT security contract', () => {
    it('issues HS256 tokens with issuer, audience, tokenVersion, and a normalized session purpose', async () => {
        const secret = 'a-test-secret-that-is-long-enough';
        const token = await signJWT({ username: 'teacher-a', role: 'teacher', tokenVersion: 1 }, secret);
        const payload = await verifyJWT(token, secret);

        expect(payload).toMatchObject({
            username: 'teacher-a',
            role: 'teacher',
            purpose: 'session',
            iss: JWT_ISSUER,
            aud: JWT_AUDIENCE,
        });
    });

    it('rejects claim-less legacy tokens unconditionally', async () => {
        const secret = 'a-test-secret-that-is-long-enough';
        const key = new TextEncoder().encode(secret);
        const legacy = await new SignJWT({ username: 'teacher-a', role: 'teacher' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(key);

        await expect(verifyJWT(legacy, secret)).resolves.toBeNull();
    });

    it('rejects non-HS256 algorithms and malformed auth payloads', async () => {
        const errorSpy = expectConsoleError();
        const secret = 'a-test-secret-that-is-long-enough';
        const key = new TextEncoder().encode(secret);
        const hs384 = await new SignJWT({ username: 'teacher-a', role: 'teacher', purpose: 'session' })
            .setProtectedHeader({ alg: 'HS384' })
            .setIssuer(JWT_ISSUER)
            .setAudience(JWT_AUDIENCE)
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(key);
        const missingRole = await new SignJWT({ username: 'teacher-a', purpose: 'session' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuer(JWT_ISSUER)
            .setAudience(JWT_AUDIENCE)
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(key);

        await expect(verifyJWT(hs384, secret)).resolves.toBeNull();
        await expect(verifyJWT(missingRole, secret)).resolves.toBeNull();
        expectConsoleMessage(errorSpy, 'Verification failed');
    });

    it('uses a host-only HttpOnly Lax cookie for browser sessions', () => {
        const cookie = createJWTCookie('signed-token', 900);
        expect(cookie).toContain('auth_token=signed-token');
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('Secure');
        expect(cookie).toContain('SameSite=Lax');
        expect(cookie).toContain('Max-Age=900');
        expect(cookie).not.toContain('Domain=');
        expect(cookie).not.toContain('SameSite=None');
    });
});

describe('teacher session version enforcement', () => {
    it('rejects Bearer transport and accepts the current cookie token version', async () => {
        const secret = 'a-test-secret-that-is-long-enough';
        const db = {
            prepare: () => ({ bind: () => ({ first: async () => ({ status: 'ACTIVE', token_version: 3, must_change_password: 0 }) }) }),
        };
        const env = { DB: db, JWT_SECRET: secret } as any;

        const current = await signJWT({ username: 'teacher-a', role: 'teacher', tokenVersion: 3, purpose: 'session' }, secret);
        const bearerResult = await verifyJWTMiddleware(new Request('https://test/api/results', {
            headers: { Authorization: `Bearer ${current}` },
        }), env);
        expect(bearerResult).toBeInstanceOf(Response);
        expect((bearerResult as Response).status).toBe(401);

        const currentResult = await verifyJWTMiddleware(new Request('https://test/api/results', {
            headers: { Cookie: `auth_token=${current}` },
        }), env);
        expect(currentResult).not.toBeInstanceOf(Response);
    });

    it('blocks every teacher route except password change while the account is pending', async () => {
        const secret = 'a-test-secret-that-is-long-enough';
        const db = {
            prepare: () => ({ bind: () => ({ first: async () => ({ status: 'ACTIVE', token_version: 1, must_change_password: 1 }) }) }),
        };
        const env = { DB: db, JWT_SECRET: secret } as any;
        const current = await signJWT({
            username: 'teacher-a', role: 'teacher', tokenVersion: 1, purpose: 'password_change',
        }, secret);

        const blocked = await verifyJWTMiddleware(new Request('https://test/api/account/me', {
            headers: { Cookie: `auth_token=${current}` },
        }), env);
        expect(blocked).toBeInstanceOf(Response);
        expect((blocked as Response).status).toBe(403);
        await expect((blocked as Response).json()).resolves.toMatchObject({ message: 'Password change required' });

        const allowed = await verifyJWTMiddleware(new Request('https://test/api/account/change-password', {
            method: 'POST',
            headers: { Cookie: `auth_token=${current}` },
        }), env);
        expect(allowed).not.toBeInstanceOf(Response);
    });
});
