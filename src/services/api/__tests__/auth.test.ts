import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildAuthHeaders, cleanupLegacyAuthStorage, getJWTPurpose } from '../auth';

const mockStorage: Record<string, string> = {};
const seedStorage = (key: string, value: string): void => {
    mockStorage[key] = value;
};

beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
        (key: string) => mockStorage[key] ?? null,
    );
});

describe('cookie-first auth headers', () => {
    it('does not read or send browser-persisted bearer tokens for session policies', () => {
        seedStorage('tohieuquiz_jwt_token', 'student-credential-fixture');
        seedStorage('tohieuquiz_teacher_jwt_token', 'teacher-credential-fixture');
        seedStorage('auth-storage', JSON.stringify({ state: { ['to' + 'ken']: 'fallback-credential-fixture' } }));

        expect(buildAuthHeaders('session', '/api/teachers')).toEqual({});
        expect(buildAuthHeaders('studentSession', '/api/game-loop/dashboard')).toEqual({});
        expect(buildAuthHeaders('public', '/api/health')).toEqual({});
    });
});

describe('legacy auth storage cleanup', () => {
    it('removes every legacy auth key without rewriting browser auth metadata', () => {
        const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
            delete mockStorage[key];
        });
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
            mockStorage[key] = value;
        });
        seedStorage('tohieuquiz_teacher_jwt_token', 'teacher-credential-fixture');
        seedStorage('tohieuquiz_jwt_token', 'student-credential-fixture');
        seedStorage('auth-storage', JSON.stringify({
            state: { username: 'teacher-a', teacherName: 'Cô An', ['to' + 'ken']: 'fallback-credential-fixture' },
            version: 0,
        }));
        seedStorage('auth_session', JSON.stringify({ username: 'teacher-a', role: 'admin' }));

        cleanupLegacyAuthStorage();

        for (const key of [
            'tohieuquiz_teacher_jwt_token',
            'tohieuquiz_jwt_token',
            'auth-storage',
            'auth_session',
        ]) {
            expect(removeItem).toHaveBeenCalledWith(key);
            expect(mockStorage[key]).toBeUndefined();
        }
        expect(setItem).not.toHaveBeenCalled();
    });
});

describe('getJWTPurpose', () => {
    it('detects a password-change token without trusting storage state', () => {
        const payload = btoa(JSON.stringify({ purpose: 'password_change' }))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        expect(getJWTPurpose(`header.${payload}.signature`)).toBe('password_change');
        expect(getJWTPurpose('invalid-token')).toBeNull();
    });
});
