// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    buildAuthSessionData,
    withAuthCookie,
    withClearedAuthCookie,
} from '../workers/src/utils/authSession';

describe('auth token transport modes', () => {
    it('keeps a short rollback window in compat mode without changing identity fields', () => {
        expect(buildAuthSessionData(
            { AUTH_TOKEN_TRANSPORT_MODE: 'compat' },
            { username: 'teacher-a', role: 'teacher' },
            'signed-token',
        )).toEqual({ username: 'teacher-a', role: 'teacher', token: 'signed-token' });
    });

    it('never exposes the signed token in cookie mode', () => {
        expect(buildAuthSessionData(
            { AUTH_TOKEN_TRANSPORT_MODE: 'cookie' },
            { username: 'teacher-a', role: 'teacher' },
            'signed-token',
        )).toEqual({ username: 'teacher-a', role: 'teacher' });
    });

    it('keeps the checked deployment config on cookie transport while legacy claims remain in compat', () => {
        const config = readFileSync('workers/wrangler.toml', 'utf8');
        expect(config).toContain('AUTH_TOKEN_TRANSPORT_MODE = "cookie"');
        expect(config).toContain('AUTH_MIGRATION_MODE = "compat"');
    });

    it('sets and clears HttpOnly auth cookies with no-store responses', () => {
        const response = withAuthCookie(
            new Response(JSON.stringify({ status: 'success' }), {
                headers: { 'Content-Type': 'application/json' },
            }),
            'signed-token',
            900,
        );
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(response.headers.get('Set-Cookie')).toContain('SameSite=Lax');

        const cleared = withClearedAuthCookie(new Response(null, { status: 204 }));
        expect(cleared.headers.get('Cache-Control')).toBe('no-store');
        expect(cleared.headers.get('Set-Cookie')).toContain('Max-Age=0');
    });
});
