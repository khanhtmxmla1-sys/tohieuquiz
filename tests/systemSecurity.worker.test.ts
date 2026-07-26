import { describe, expect, it } from 'vitest';
import {
    generateTemporaryPassword,
    hashPasswordPbkdf2,
    isPbkdf2Password,
    validateNewPassword,
    verifyPasswordPbkdf2,
} from '../workers/src/utils/password';
import { verifyToken } from '../workers/src/middleware/auth';
import { internalErrorResponse } from '../workers/src/utils/internalError';
import { errorResponse } from '../workers/src/utils/response';
import { corsHeaders, handleCors } from '../workers/src/middleware/cors';
import { enforceOriginGuard } from '../workers/src/middleware/originGuard';
import { vi } from 'vitest';

describe('system security password storage', () => {
    it('stores a salted PBKDF2 record and verifies only the correct password', async () => {
        const first = await hashPasswordPbkdf2('Mat-khau-rat-manh-2026');
        const second = await hashPasswordPbkdf2('Mat-khau-rat-manh-2026');
        expect(isPbkdf2Password(first)).toBe(true);
        expect(first).not.toBe(second);
        expect(first).not.toContain('Mat-khau-rat-manh-2026');
        expect(first).toMatch(/^pbkdf2_sha256\$100000\$/);
        expect(await verifyPasswordPbkdf2('Mat-khau-rat-manh-2026', first)).toBe(true);
        expect(await verifyPasswordPbkdf2('sai-mat-khau', first)).toBe(false);
    });

    it('accepts the alternate dollar/base64 PBKDF2 encoding during migration', async () => {
        const password = 'Mat-khau-tuong-thich-2026';
        const salt = new Uint8Array(16).fill(7);
        const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
            material,
            256,
        );
        const base64Url = (value: Uint8Array) => {
            let binary = '';
            for (const byte of value) binary += String.fromCharCode(byte);
            return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        };
        const encoded = `$pbkdf2-sha256$100000$${base64Url(salt)}$${base64Url(new Uint8Array(bits))}`;

        expect(isPbkdf2Password(encoded)).toBe(true);
        expect(await verifyPasswordPbkdf2(password, encoded)).toBe(true);
        expect(await verifyPasswordPbkdf2('sai-mat-khau', encoded)).toBe(false);
    });

    it('generates a 20-character one-time password using the allowed alphabet', () => {
        const value = generateTemporaryPassword();
        expect(value).toHaveLength(20);
        expect(value).toMatch(/^[A-HJ-NP-Za-km-z2-9!@#$%]+$/);
    });

    it('enforces password length boundaries', () => {
        expect(validateNewPassword('123456789')).toBeTruthy();
        expect(validateNewPassword('1234567890')).toBeNull();
        expect(validateNewPassword('x'.repeat(129))).toBeTruthy();
    });

    it('routes account and admin management through JWT authorization', () => {
        const request = (path: string) => new Request(`https://api.thtohieu.com${path}`);
        expect(verifyToken(request('/api/account/me'), {} as any)).toBeNull();
        expect(verifyToken(request('/api/admin/teachers'), {} as any)).toBeNull();
        expect(verifyToken(request('/api/admin/announcements'), {} as any)).toBeNull();
        expect(verifyToken(request('/api/notifications'), {} as any)).toBeNull();
    });

    it('allows student session restore to reach JWT authorization', () => {
        const request = new Request('https://api.thtohieu.com/api/student-profile');
        expect(verifyToken(request, {} as any)).toBeNull();
    });

    it('allows quiz draft routes to reach their teacher JWT handler', () => {
        const request = new Request('https://api.thtohieu.com/api/quiz-drafts/draft-123', {
            method: 'PUT',
        });
        expect(verifyToken(request, {} as any)).toBeNull();
    });

    it('does not accept the removed shared API token on unclassified routes', () => {
        const request = new Request('https://api.thtohieu.com/api/unclassified', {
            headers: { 'X-API-Token': 'old-shared-token' },
        });
        const result = verifyToken(request, {} as any);
        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(401);
    });

    it('allows AI routes to reach their JWT-validating handlers', () => {
        const request = new Request('https://api.thtohieu.com/api/ai/chat', { method: 'POST' });
        expect(verifyToken(request, {} as any)).toBeNull();
    });

    it('allows result-report routes to reach their role-aware JWT handlers', () => {
        const cohort = new Request('https://api.thtohieu.com/api/result-reports/cohort', {
            method: 'POST',
        });
        const studentReports = new Request('https://api.thtohieu.com/api/result-reports/mine');

        expect(verifyToken(cohort, {} as any)).toBeNull();
        expect(verifyToken(studentReports, {} as any)).toBeNull();
    });

    it('returns a generic 500 response with requestId while logging the original error', async () => {
        const request = new Request('https://api.thtohieu.com/api/failing', {
            headers: { 'x-request-id': 'req-security-1' },
        });
        const logger = { error: vi.fn() };
        const response = internalErrorResponse(
            new Error('D1_ERROR: no such table: teachers'),
            request,
            { context: 'system-security-test', logger },
        );
        const payload = await response.json() as any;

        expect(response.status).toBe(500);
        expect(payload).toEqual({
            status: 'error',
            message: 'Internal server error',
            requestId: 'req-security-1',
        });
        expect(JSON.stringify(payload)).not.toContain('teachers');
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('requestId=req-security-1'),
            expect.any(Error),
        );
    });

    it('keeps explicit 4xx business messages unchanged', async () => {
        const response = errorResponse('Forbidden: Teacher access required', 403);
        await expect(response.json()).resolves.toEqual({
            status: 'error',
            message: 'Forbidden: Teacher access required',
        });
    });

    it('allows only explicitly configured HTTPS origins in production', () => {
        const production = {
            ENVIRONMENT: 'production',
            ALLOWED_ORIGINS: [
                'https://www.thtohieu.com',
                'https://phuhuynh.thtohieu.com',
                'https://tohieuquiz1-abc123-khanhs-projects-e97e400d.vercel.app',
                'https://tohieuquiz1-khanhs-projects-e97e400d.vercel.app',
            ].join(','),
        } as any;
        const official = new Request('https://api.thtohieu.com/api/health', {
            headers: { Origin: 'https://www.thtohieu.com' },
        });
        const preview = new Request('https://api.thtohieu.com/api/health', {
            headers: { Origin: 'https://tohieuquiz1-abc123-khanhs-projects-e97e400d.vercel.app' },
        });
        const productionAlias = new Request('https://api.thtohieu.com/api/health', {
            headers: { Origin: 'https://tohieuquiz1-khanhs-projects-e97e400d.vercel.app' },
        });
        const apiOrigin = new Request('https://api.thtohieu.com/api/health', {
            headers: { Origin: 'https://api.thtohieu.com' },
        });
        const parentOrigin = new Request('https://api.thtohieu.com/api/health', {
            headers: { Origin: 'https://phuhuynh.thtohieu.com' },
        });
        const fakePreview = new Request('https://api.thtohieu.com/api/health', {
            headers: { Origin: 'https://tohieuquiz1-abc123-attacker.vercel.app' },
        });
        const localhost = new Request('https://api.thtohieu.com/api/health', {
            headers: { Origin: 'http://localhost:5173' },
        });

        expect(corsHeaders(official, production)['Access-Control-Allow-Origin']).toBe('https://www.thtohieu.com');
        expect(corsHeaders(preview, production)['Access-Control-Allow-Origin']).toBe(preview.headers.get('Origin'));
        expect(corsHeaders(productionAlias, production)['Access-Control-Allow-Origin']).toBe(productionAlias.headers.get('Origin'));
        expect(corsHeaders(apiOrigin, production)['Access-Control-Allow-Origin']).toBe('https://api.thtohieu.com');
        expect(corsHeaders(parentOrigin, production)['Access-Control-Allow-Origin']).toBe('https://phuhuynh.thtohieu.com');
        expect(corsHeaders(fakePreview, production)['Access-Control-Allow-Origin']).toBeUndefined();
        expect(corsHeaders(localhost, production)['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('allows localhost only in development or on a local Worker host', () => {
        const remoteRequest = new Request('https://api.thtohieu.com/api/health', {
            headers: { Origin: 'http://localhost:5173' },
        });
        const localWorkerRequest = new Request('http://127.0.0.1:8787/api/health', {
            headers: { Origin: 'http://localhost:5173' },
        });

        expect(corsHeaders(remoteRequest, { ENVIRONMENT: 'development' } as any)['Access-Control-Allow-Origin'])
            .toBe('http://localhost:5173');
        expect(corsHeaders(localWorkerRequest, { ENVIRONMENT: 'production' } as any)['Access-Control-Allow-Origin'])
            .toBe('http://localhost:5173');
    });

    it('rejects invalid preflight origins without reflecting them', async () => {
        const request = new Request('https://api.thtohieu.com/api/account/me', {
            method: 'OPTIONS',
            headers: {
                Origin: 'https://evil.example',
                'Access-Control-Request-Method': 'POST',
            },
        });
        const response = handleCors(request, { ENVIRONMENT: 'production' } as any);

        expect(response?.status).toBe(403);
        expect(response?.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('blocks unsafe cookie-authenticated requests from an untrusted origin', async () => {
        const blocked = enforceOriginGuard(new Request('https://api.thtohieu.com/api/account/change-password', {
            method: 'POST',
            headers: {
                Origin: 'https://evil.example',
                Cookie: 'auth_token=secret',
            },
        }), { ENVIRONMENT: 'production' } as any);
        const allowed = enforceOriginGuard(new Request('https://api.thtohieu.com/api/account/change-password', {
            method: 'POST',
            headers: {
                Origin: 'https://www.thtohieu.com',
                Cookie: 'auth_token=secret',
            },
        }), { ENVIRONMENT: 'production', ALLOWED_ORIGINS: 'https://www.thtohieu.com' } as any);

        expect(blocked?.status).toBe(403);
        await expect(blocked?.json()).resolves.toMatchObject({ message: expect.stringMatching(/origin/i) });
        expect(allowed).toBeNull();
    });

});
