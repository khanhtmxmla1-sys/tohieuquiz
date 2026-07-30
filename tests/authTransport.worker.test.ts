// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    buildAuthSessionData,
    withAuthCookie,
    withClearedAuthCookie,
} from '../workers/src/utils/authSession';

describe('cookie-only auth transport', () => {
    it('never exposes a signed token in session response data', () => {
        expect(buildAuthSessionData(
            { username: 'teacher-a', role: 'teacher' },
        )).toEqual({ username: 'teacher-a', role: 'teacher' });
    });

    it('removes auth compatibility flags from checked deployment config', () => {
        const config = readFileSync('workers/wrangler.toml', 'utf8');
        expect(config).not.toContain('AUTH_TOKEN_TRANSPORT_MODE');
        expect(config).not.toContain('AUTH_MIGRATION_MODE');
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
