// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import {
    JWT_AUDIENCE,
    JWT_ISSUER,
    createJWTCookie,
    signJWT,
    verifyJWT,
} from '../workers/src/utils/jwt';
import { verifyJWTMiddleware } from '../workers/src/middleware/jwtAuth';

describe('JWT security contract', () => {
    it('issues HS256 tokens with issuer, audience, and a normalized session purpose', async () => {
        const secret = 'a-test-secret-that-is-long-enough';
        const token = await signJWT({ username: 'teacher-a', role: 'teacher' }, secret);
        const payload = await verifyJWT(token, secret, { allowLegacy: false });

        expect(payload).toMatchObject({
            username: 'teacher-a',
            role: 'teacher',
            purpose: 'session',
            iss: JWT_ISSUER,
            aud: JWT_AUDIENCE,
        });
    });

    it('accepts a claim-less legacy token only while legacy mode is explicitly enabled', async () => {
        const secret = 'a-test-secret-that-is-long-enough';
        const key = new TextEncoder().encode(secret);
        const legacy = await new SignJWT({ username: 'teacher-a', role: 'teacher' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(key);

        await expect(verifyJWT(legacy, secret, { allowLegacy: true })).resolves.toMatchObject({
            username: 'teacher-a',
            purpose: 'session',
        });
        await expect(verifyJWT(legacy, secret, { allowLegacy: false })).resolves.toBeNull();
    });

    it('rejects non-HS256 algorithms and malformed auth payloads', async () => {
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

        await expect(verifyJWT(hs384, secret, { allowLegacy: false })).resolves.toBeNull();
        await expect(verifyJWT(missingRole, secret, { allowLegacy: false })).resolves.toBeNull();
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
    it('rejects legacy JWTs in enforce mode and accepts the current token version', async () => {
        const secret = 'a-test-secret-that-is-long-enough';
        const db = {
            prepare: () => ({ bind: () => ({ first: async () => ({ status: 'ACTIVE', token_version: 3, must_change_password: 0 }) }) }),
        };
        const env = { DB: db, JWT_SECRET: secret, AUTH_MIGRATION_MODE: 'enforce' } as any;

        const legacy = await signJWT({ username: 'teacher-a', role: 'teacher' }, secret);
        const legacyResult = await verifyJWTMiddleware(new Request('https://test/api/results', {
            headers: { Authorization: `Bearer ${legacy}` },
        }), env);
        expect(legacyResult).toBeInstanceOf(Response);
        expect((legacyResult as Response).status).toBe(401);

        const current = await signJWT({ username: 'teacher-a', role: 'teacher', tokenVersion: 3, purpose: 'session' }, secret);
        const currentResult = await verifyJWTMiddleware(new Request('https://test/api/results', {
            headers: { Authorization: `Bearer ${current}` },
        }), env);
        expect(currentResult).not.toBeInstanceOf(Response);
    });

    it('blocks every teacher route except password change while the account is pending', async () => {
        const secret = 'a-test-secret-that-is-long-enough';
        const db = {
            prepare: () => ({ bind: () => ({ first: async () => ({ status: 'ACTIVE', token_version: 1, must_change_password: 1 }) }) }),
        };
        const env = { DB: db, JWT_SECRET: secret, AUTH_MIGRATION_MODE: 'compat' } as any;
        const legacy = await signJWT({ username: 'teacher-a', role: 'teacher' }, secret);

        const blocked = await verifyJWTMiddleware(new Request('https://test/api/account/me', {
            headers: { Authorization: `Bearer ${legacy}` },
        }), env);
        expect(blocked).toBeInstanceOf(Response);
        expect((blocked as Response).status).toBe(403);
        await expect((blocked as Response).json()).resolves.toMatchObject({ message: 'Password change required' });

        const allowed = await verifyJWTMiddleware(new Request('https://test/api/account/change-password', {
            method: 'POST',
            headers: { Authorization: `Bearer ${legacy}` },
        }), env);
        expect(allowed).not.toBeInstanceOf(Response);
    });
});
